import assert from 'node:assert/strict'
import { HEADER_COLLAPSE_AT, HEADER_EXPAND_AT, resolveHeaderCollapsed } from '../src/lib/header-scroll.ts'

assert.equal(resolveHeaderCollapsed(false, 0), false, 'header começa expandido')
assert.equal(resolveHeaderCollapsed(false, HEADER_COLLAPSE_AT - 1), false, 'não recolhe antes do limite')
assert.equal(resolveHeaderCollapsed(false, HEADER_COLLAPSE_AT), true, 'recolhe no limite inferior')
assert.equal(resolveHeaderCollapsed(true, HEADER_COLLAPSE_AT - 1), true, 'permanece recolhido na zona estável')
assert.equal(resolveHeaderCollapsed(true, HEADER_EXPAND_AT + 1), true, 'não expande antes do limite superior')
assert.equal(resolveHeaderCollapsed(true, HEADER_EXPAND_AT), false, 'expande próximo ao topo')
assert.equal(resolveHeaderCollapsed(false, -20), false, 'overscroll negativo não altera o estado')

console.log('Header scroll hysteresis validated.')
