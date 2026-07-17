import 'dotenv/config'
import path from 'node:path'
import process from 'node:process'
import { DatabaseSync } from 'node:sqlite'
import mysql from 'mysql2/promise'

const args = new Set(process.argv.slice(2))
const createOnly = args.has('--create-only')
const replace = args.has('--replace')
const sourcePath = path.resolve(process.env.SQLITE_SOURCE_PATH || 'db/custom.db')
const targetUrl = process.env.MYSQL_DATABASE_URL || process.env.DATABASE_URL || ''

if (!targetUrl.startsWith('mysql:')) {
  throw new Error('Defina DATABASE_URL ou MYSQL_DATABASE_URL com uma URL mysql://...')
}

const parsed = new URL(targetUrl)
const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ''))
if (!/^[a-zA-Z0-9_]+$/.test(databaseName)) throw new Error('Nome do banco MySQL inválido.')

const connectionOptions = {
  host: parsed.hostname || '127.0.0.1',
  port: Number(parsed.port || 3306),
  user: decodeURIComponent(parsed.username || 'root'),
  password: decodeURIComponent(parsed.password || ''),
  charset: 'utf8mb4',
  timezone: 'Z',
}

const server = await mysql.createConnection(connectionOptions)
await server.query(
  `CREATE DATABASE IF NOT EXISTS \`${databaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
)
await server.end()
console.log(`[mysql] banco ${databaseName} disponível.`)

if (createOnly) process.exit(0)

const target = await mysql.createConnection({ ...connectionOptions, database: databaseName })
const source = new DatabaseSync(sourcePath, { readOnly: true })

function sqliteIdentifier(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`
}

function normalizeValue(value, column) {
  if (value === null || value === undefined) return null
  if (['date', 'datetime', 'timestamp'].includes(column.dataType)) {
    const date = typeof value === 'number' || /^\d+$/.test(String(value))
      ? new Date(Number(value))
      : new Date(String(value))
    if (Number.isNaN(date.getTime())) {
      throw new Error(`Data inválida em ${column.table}.${column.name}: ${String(value)}`)
    }
    return date
  }
  if (typeof value === 'bigint') return value.toString()
  if (typeof value === 'string' && column.maxLength && [...value].length > column.maxLength) {
    throw new Error(
      `Conteúdo excede ${column.maxLength} caracteres em ${column.table}.${column.name} (${[...value].length}).`,
    )
  }
  return value
}

try {
  const sourceTables = source.prepare(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table'
      AND name NOT LIKE 'sqlite_%'
      AND name != '_prisma_migrations'
    ORDER BY name
  `).all().map(row => String(row.name))

  const [targetTableRows] = await target.query(
    `SELECT TABLE_NAME AS tableName
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'`,
    [databaseName],
  )
  const targetTables = new Map(targetTableRows.map(row => [String(row.tableName).toLowerCase(), String(row.tableName)]))
  if (targetTables.size === 0) {
    throw new Error('O schema MySQL ainda não foi criado. Execute `npm run db:push` antes da migração.')
  }

  const missingTables = sourceTables.filter(table => !targetTables.has(table.toLowerCase()))
  if (missingTables.length) throw new Error(`Tabelas ausentes no MySQL: ${missingTables.join(', ')}`)

  const tablePlans = []
  let sourceTotal = 0
  for (const sourceTable of sourceTables) {
    const targetTable = targetTables.get(sourceTable.toLowerCase())
    const sourceColumns = source.prepare(`PRAGMA table_info(${sqliteIdentifier(sourceTable)})`).all()
      .map(row => String(row.name))
    const [targetColumnsRaw] = await target.query(
      `SELECT COLUMN_NAME AS columnName, DATA_TYPE AS dataType,
              CHARACTER_MAXIMUM_LENGTH AS maxLength
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
       ORDER BY ORDINAL_POSITION`,
      [databaseName, targetTable],
    )
    const targetColumns = new Map(targetColumnsRaw.map(column => [String(column.columnName).toLowerCase(), {
      table: targetTable,
      name: String(column.columnName),
      dataType: String(column.dataType).toLowerCase(),
      maxLength: column.maxLength === null ? null : Number(column.maxLength),
    }]))
    const missingColumns = sourceColumns.filter(column => !targetColumns.has(column.toLowerCase()))
    if (missingColumns.length) {
      throw new Error(`Colunas ausentes em ${targetTable}: ${missingColumns.join(', ')}`)
    }
    const columns = sourceColumns.map(column => targetColumns.get(column.toLowerCase()))
    const rows = source.prepare(`SELECT * FROM ${sqliteIdentifier(sourceTable)}`).all()
    sourceTotal += rows.length
    tablePlans.push({ sourceTable, targetTable, columns, rows })
  }

  let hasExistingData = false
  for (const table of targetTables.values()) {
    const [[row]] = await target.query('SELECT COUNT(*) AS total FROM ??', [table])
    if (Number(row.total) > 0) {
      hasExistingData = true
      break
    }
  }
  if (hasExistingData && !replace) {
    throw new Error('O banco de destino contém dados. Use --replace somente após confirmar que deseja substituí-los.')
  }

  await target.query('SET FOREIGN_KEY_CHECKS = 0')
  await target.beginTransaction()
  try {
    if (replace) {
      for (const table of targetTables.values()) await target.query('DELETE FROM ??', [table])
    }

    for (const plan of tablePlans) {
      const columnNames = plan.columns.map(column => column.name)
      for (let offset = 0; offset < plan.rows.length; offset += 200) {
        const chunk = plan.rows.slice(offset, offset + 200).map(row => plan.columns.map(column => (
          normalizeValue(row[column.name], column)
        )))
        if (chunk.length) await target.query('INSERT INTO ?? (??) VALUES ?', [plan.targetTable, columnNames, chunk])
      }
      console.log(`[migrate] ${plan.sourceTable}: ${plan.rows.length}`)
    }
    await target.commit()
  } catch (error) {
    await target.rollback()
    throw error
  } finally {
    await target.query('SET FOREIGN_KEY_CHECKS = 1')
  }

  let targetTotal = 0
  for (const plan of tablePlans) {
    const [[countRow]] = await target.query('SELECT COUNT(*) AS total FROM ??', [plan.targetTable])
    const targetCount = Number(countRow.total)
    targetTotal += targetCount
    if (targetCount !== plan.rows.length) {
      throw new Error(`Contagem divergente em ${plan.targetTable}: SQLite=${plan.rows.length}, MySQL=${targetCount}`)
    }
  }
  if (sourceTotal !== targetTotal) {
    throw new Error(`Total divergente: SQLite=${sourceTotal}, MySQL=${targetTotal}`)
  }
  console.log(`[verify] ${tablePlans.length} tabelas e ${targetTotal} registros conferidos.`)
} finally {
  source.close()
  await target.end()
}
