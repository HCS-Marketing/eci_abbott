const http = require("http")

function testEndpoint(path, params) {
  const query = new URLSearchParams(params).toString()
  const url = `http://localhost:3000${path}?${query}`
  
  return new Promise((resolve, reject) => {
    console.log(`\n🔍 Testing: ${url}`)
    http.get(url, (res) => {
      let data = ""
      res.on("data", chunk => data += chunk)
      res.on("end", () => {
        try {
          const json = JSON.parse(data)
          resolve(json)
        } catch (e) {
          resolve(data)
        }
      })
    }).on("error", reject)
  })
}

async function main() {
  console.log("🧪 Testing provider API endpoints...\n")
  
  try {
    // Test health
    const health = await testEndpoint("/api/provider", { action: "health" })
    console.log("✅ Health:", JSON.stringify(health, null, 2))
    
    // Test categories
    const categories = await testEndpoint("/api/provider", { action: "categories" })
    console.log("\n📋 Categories:", JSON.stringify(categories, null, 2))
    
    // Test raw data (limited to 2 rows)
    const raw = await testEndpoint("/api/provider", { action: "raw", limit: "2" })
    console.log("\n📊 Raw data sample:")
    if (Array.isArray(raw)) {
      raw.forEach((r, i) => {
        console.log(`\n${i + 1}.`)
        console.log(`   Titulo: ${r.titulo}`)
        console.log(`   EAN: ${r.ean}`)
        console.log(`   Categoria: ${r.categoria}`)
      })
    }
    
  } catch (err) {
    console.error("❌ Error:", err.message)
    console.log("\n⚠️  Make sure the Next.js dev server is running on port 3000")
    console.log("   Run: npm run dev")
  }
}

main()
