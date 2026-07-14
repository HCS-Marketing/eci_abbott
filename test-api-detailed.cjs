const http = require("http")

async function testAPI() {
  console.log("🧪 Testing API endpoints...\n")

  // Test categories endpoint
  const categoriesUrl = "http://localhost:3000/api/provider?action=categories"
  console.log(`📍 Testing: ${categoriesUrl}`)
  
  const categories = await new Promise((resolve, reject) => {
    http.get(categoriesUrl, (res) => {
      let data = ""
      res.on("data", chunk => data += chunk)
      res.on("end", () => {
        console.log(`   Status: ${res.statusCode}`)
        try {
          const json = JSON.parse(data)
          resolve(json)
        } catch {
          resolve(data)
        }
      })
    }).on("error", reject)
  })

  console.log("   Response:", JSON.stringify(categories, null, 2))

  // Test inventory endpoint with limit
  const inventoryUrl = "http://localhost:3000/api/provider?action=inventory&date=2026-07-14&limit=2"
  console.log(`\n📍 Testing: ${inventoryUrl}`)
  
  const inventory = await new Promise((resolve, reject) => {
    http.get(inventoryUrl, (res) => {
      let data = ""
      res.on("data", chunk => data += chunk)
      res.on("end", () => {
        console.log(`   Status: ${res.statusCode}`)
        try {
          const json = JSON.parse(data)
          resolve(json)
        } catch {
          resolve(data)
        }
      })
    }).on("error", reject)
  })

  if (typeof inventory === 'string') {
    console.log("   Response (text):", inventory.substring(0, 200))
  } else if (Array.isArray(inventory)) {
    console.log(`   Response: Array with ${inventory.length} items`)
    if (inventory.length > 0) {
      console.log("\n   First item:")
      const first = inventory[0]
      console.log("   {")
      console.log(`     producto: "${first.producto}"`)
      console.log(`     ean: "${first.ean}"`)
      console.log(`     categoria: "${first.categoria}"`)
      console.log(`     canal: "${first.canal}"`)
      console.log("   }")
    }
  } else {
    console.log("   Response:", inventory)
  }

  // Test raw endpoint
  const rawUrl = "http://localhost:3000/api/provider?action=raw&limit=2"
  console.log(`\n📍 Testing: ${rawUrl}`)
  
  const raw = await new Promise((resolve, reject) => {
    http.get(rawUrl, (res) => {
      let data = ""
      res.on("data", chunk => data += chunk)
      res.on("end", () => {
        console.log(`   Status: ${res.statusCode}`)
        try {
          const json = JSON.parse(data)
          resolve(json)
        } catch {
          resolve(data)
        }
      })
    }).on("error", reject)
  })

  if (typeof raw === 'string') {
    console.log("   Response (text):", raw.substring(0, 200))
  } else if (Array.isArray(raw)) {
    console.log(`   Response: Array with ${raw.length} items`)
    if (raw.length > 0) {
      console.log("\n   First item:")
      const first = raw[0]
      console.log("   {")
      console.log(`     titulo: "${first.titulo?.substring(0, 50)}"`)
      console.log(`     ean: "${first.ean}"`)
      console.log(`     categoria: "${first.categoria}"`)
      console.log(`     retail: "${first.retail}"`)
      console.log(`     fecha: "${first.fecha}"`)
      console.log("   }")
    }
  } else {
    console.log("   Response:", raw)
  }
}

testAPI().catch(err => {
  console.error("❌ Error:", err.message)
})
