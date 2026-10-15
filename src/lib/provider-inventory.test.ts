import assert from "node:assert/strict"
import test from "node:test"
import { buildProviderInventoryRows, type ProviderInventorySourceRow } from "./provider-inventory"

function row(
  fecha: string,
  retail: string,
  ean: string,
  disponible: boolean,
  titulo = `Producto ${ean}`
): ProviderInventorySourceRow {
  return {
    fecha,
    retail,
    titulo,
    ean,
    categoria: "FORMULAS",
    disponibilidad: disponible ? "DISPONIBLE" : "NO DISPONIBLE",
    disponible,
    posicion: null,
  }
}

test("usa las ultimas siete fechas scrapeadas y cuenta ausencias como no disponible", () => {
  const dates = [
    "2026-10-05",
    "2026-10-06",
    "2026-10-07",
    "2026-10-08",
    "2026-10-09",
    "2026-10-13",
    "2026-10-14",
  ]
  const targetEan = "8427030005003"
  const rows = dates.map(date => row(date, "LA REBAJA", `control-${date}`, true))
  rows.push(...dates.slice(0, 5).map(date => row(date, "LA REBAJA", targetEan, true)))
  rows.push(row("2026-10-14", "LA REBAJA", targetEan, false, "SIMILAC AR IQ PLUS"))

  const [inventory] = buildProviderInventoryRows(rows, "2026-10-14", { eans: [targetEan] })

  assert.equal(inventory.stock_status, "break")
  assert.equal(inventory.dias_observados_7d, 7)
  assert.equal(inventory.dias_disponibles_7d, 5)
  assert.equal(inventory.porcentaje_disponibilidad_7d, 71)
})

test("calcula las fechas de scraping por retail", () => {
  const rows = [
    row("2026-10-01", "LA REBAJA", "1", true),
    row("2026-10-14", "LA REBAJA", "1", true),
    row("2026-10-10", "CRUZ VERDE", "2", true),
    row("2026-10-11", "CRUZ VERDE", "control", true),
    row("2026-10-12", "CRUZ VERDE", "control", true),
    row("2026-10-14", "CRUZ VERDE", "2", false),
  ]

  const inventory = buildProviderInventoryRows(rows, "2026-10-14")
  const laRebaja = inventory.find(item => item.canal === "LA REBAJA")
  const cruzVerde = inventory.find(item => item.canal === "CRUZ VERDE" && item.ean === "2")

  assert.equal(laRebaja?.dias_observados_7d, 2)
  assert.equal(cruzVerde?.dias_observados_7d, 4)
  assert.equal(cruzVerde?.dias_disponibles_7d, 1)
})

test("usa todas las fechas disponibles cuando hay menos de siete", () => {
  const rows = [
    row("2026-10-09", "LA REBAJA", "1", true),
    row("2026-10-13", "LA REBAJA", "1", false),
    row("2026-10-14", "LA REBAJA", "1", true),
  ]

  const [inventory] = buildProviderInventoryRows(rows, "2026-10-14")

  assert.equal(inventory.dias_observados_7d, 3)
  assert.equal(inventory.dias_disponibles_7d, 2)
  assert.equal(inventory.porcentaje_disponibilidad_7d, 67)
})

test("conserva no disponible ante estados conflictivos del mismo dia", () => {
  const rows = [
    row("2026-10-14", "LA REBAJA", "1", true),
    row("2026-10-14", "LA REBAJA", "1", false),
  ]

  const [inventory] = buildProviderInventoryRows(rows, "2026-10-14")

  assert.equal(inventory.stock_status, "break")
  assert.equal(inventory.dias_disponibles_7d, 0)
  assert.equal(inventory.porcentaje_disponibilidad_7d, 0)
})
