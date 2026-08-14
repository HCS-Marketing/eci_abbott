#!/usr/bin/env node
// Debug script para verificar qué está en las vistas materializadas de marca y titulo

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Try to read DATABASE_URL from .env.local
let DB = null;
try {
  if (fs.existsSync('.env.local')) {
    const env = fs.readFileSync('.env.local', 'utf8');
    DB = env.match(/DATABASE_URL="?([^"\r\n]+)"?/)?.[1];
  }
} catch (e) {
  console.log("Could not read .env.local");
}

// Fall back to environment variable
DB = DB || process.env.DATABASE_URL;

if (!DB) {
  console.error("❌ DATABASE_URL not found in .env.local or environment variable");
  process.exit(1);
}

console.log("✅ Connected to database");

const pool = new Pool({ connectionString: DB });

async function debugMarcaBrands() {
  try {
    console.log("\n=== DEBUG: mv_sos_daily_marca DATA ===\n");

    // 1. Verificar si la tabla tiene datos en general
    let result = await pool.query(`SELECT COUNT(*)::int as total FROM eci.mv_sos_daily_marca`);
    console.log(`Total rows in mv_sos_daily_marca: ${result.rows[0].total}`);

    // 2. Verificar fabricantes disponibles
    result = await pool.query(`
      SELECT DISTINCT fabricante, COUNT(*)::int as marca_count 
      FROM eci.mv_sos_daily_marca 
      GROUP BY fabricante 
      ORDER BY marca_count DESC 
      LIMIT 10
    `);
    console.log("\nFabricantes en mv_sos_daily_marca:");
    result.rows.forEach(r => {
      console.log(`  ${r.fabricante}: ${r.marca_count} marcas`);
    });

    // 3. Verificar si hay marcas para ABBOTT
    result = await pool.query(`
      SELECT DISTINCT marca, COUNT(*)::int as count 
      FROM eci.mv_sos_daily_marca 
      WHERE fabricante = 'ABBOTT' 
      GROUP BY marca 
      ORDER BY count DESC 
      LIMIT 20
    `);
    console.log(`\nMarcas para ABBOTT en mv_sos_daily_marca: ${result.rows.length}`);
    result.rows.forEach(r => {
      console.log(`  ${r.marca}: ${r.count}`);
    });

    // 4. Verificar datos de titulo para comparación
    console.log("\n=== DEBUG: mv_sos_daily_titulo DATA ===\n");
    
    result = await pool.query(`SELECT COUNT(*)::int as total FROM eci.mv_sos_daily_titulo`);
    console.log(`Total rows in mv_sos_daily_titulo: ${result.rows[0].total}`);

    // 5. Verificar fabricantes en titulo
    result = await pool.query(`
      SELECT DISTINCT fabricante, COUNT(*)::int as titulo_count 
      FROM eci.mv_sos_daily_titulo 
      GROUP BY fabricante 
      ORDER BY titulo_count DESC 
      LIMIT 10
    `);
    console.log("\nFabricantes en mv_sos_daily_titulo:");
    result.rows.forEach(r => {
      console.log(`  ${r.fabricante}: ${r.titulo_count} titulos`);
    });

    // 6. Verificar titulos para ABBOTT
    result = await pool.query(`
      SELECT COUNT(*)::int as total FROM eci.mv_sos_daily_titulo WHERE fabricante = 'ABBOTT'
    `);
    console.log(`\nTotales para ABBOTT en mv_sos_daily_titulo: ${result.rows[0].total}`);

    // 7. Buscar el problema: marcas nulas o 'nan'
    result = await pool.query(`
      SELECT COUNT(*)::int as null_count FROM eci.mv_sos_daily_marca 
      WHERE marca IS NULL OR TRIM(marca) = '' OR LOWER(TRIM(marca)) = 'nan'
    `);
    console.log(`\nMarcas con problemas (NULL, empty, o 'nan'): ${result.rows[0].null_count}`);

    // 8. Muestra si ABBOTT existe o no
    const abbottCountResult = await pool.query(`
      SELECT COUNT(*)::int as count FROM eci.mv_sos_daily_marca WHERE fabricante = 'ABBOTT'
    `);
    
    if (abbottCountResult.rows[0].count > 0) {
      console.log("\n✅ ABBOTT tiene registros en mv_sos_daily_marca");
    } else {
      console.log("\n❌ ABBOTT NO tiene registros en mv_sos_daily_marca - ESTE ES EL PROBLEMA");
    }

  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    await pool.end();
  }
}

debugMarcaBrands();
