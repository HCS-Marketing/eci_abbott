import { ChevronDown } from "lucide-react"
import { useState } from "react"

export default function ContentGlossary() {
  const [isOpen, setIsOpen] = useState(false)

  const glossaryTerms = [
    {
      term: "Puntaje (Score)",
      description: "Puntuación general del producto basada en la valoración de clientes y cantidad de reviews.",
      details: [
        "Se calcula considerando las reseñas y valoraciones que han dejado los clientes en la plataforma.",
        "Mayor cantidad de reviews positivos = mayor puntaje.",
        "Rango: 0 - máximo depende de los datos históricos.",
        "Indicador de popularidad y satisfacción del cliente.",
      ],
    },
    {
      term: "Puntaje Contenido",
      description: "Evaluación de la calidad del contenido del producto en la plataforma de venta.",
      details: [
        "Se calcula automáticamente según criterios específicos para Amazon y Mercado Libre.",
        "Máximo puntaje posible: 100 puntos.",
      ],
      platforms: [
        {
          name: "Amazon",
          criteria: [
            "Título entre 70-120 caracteres: +25 puntos",
            "Mínimo 5 imágenes: +20 puntos",
            "Mínimo 1 video: +15 puntos",
            "Descripción entre 1,200-1,500 caracteres: +25 puntos",
            "Mínimo 5 bullet points: +15 puntos",
          ],
        },
        {
          name: "Mercado Libre",
          criteria: [
            "Título entre 60-120 caracteres: +25 puntos",
            "Descripción entre 300-500 caracteres: +25 puntos",
            "Entre 5-10 imágenes: +20 puntos",
            "Mínimo 5 bullet points: +20 puntos",
            "Mínimo 1 video: +10 puntos",
          ],
        },
      ],
    },
    {
      term: "Valoración",
      description: "Calificación promedio del producto dada por los clientes.",
      details: [
        "Escala: 0 a 5 estrellas.",
        "Se calcula como el promedio de todas las valoraciones de clientes.",
        "Mayor valoración indica mejor satisfacción del cliente.",
      ],
    },
    {
      term: "Reviews",
      description: "Cantidad total de reseñas que ha recibido el producto.",
      details: [
        "Incluye todas las evaluaciones y comentarios dejados por clientes.",
        "Mayor cantidad de reviews proporciona más confiabilidad al puntaje.",
        "Indicador de visibilidad y adopción del producto.",
      ],
    },
    {
      term: "Contenido Multimedia",
      description: "Elementos visuales que enriquecen la presentación del producto.",
      details: [
        "Imágenes: Fotografías del producto desde diferentes ángulos y en uso.",
        "Videos: Demostraciones o tutoriales del producto.",
        "Mayor cantidad de contenido multimedia mejora la experiencia del comprador.",
      ],
    },
  ]

  return (
    <div className="bg-white border border-gray-100 shadow-sm rounded-xl overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-5 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors"
      >
        <div className="text-left">
          <div className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold">Glosario</div>
          <div className="text-xs text-gray-600 mt-0.5">Definiciones de términos utilizados en esta página</div>
        </div>
        <ChevronDown
          size={18}
          className={`text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div className="divide-y divide-gray-100">
          {glossaryTerms.map((item, idx) => (
            <div key={idx} className="px-5 py-4">
              <div className="flex items-start gap-3 mb-2">
                <div className="text-xs font-bold text-purple-600 bg-purple-50 px-2.5 py-1 rounded-full border border-purple-100 whitespace-nowrap mt-0.5">
                  {item.term}
                </div>
              </div>
              <p className="text-xs text-gray-700 mb-2">{item.description}</p>
              
              {item.details && (
                <ul className="text-xs text-gray-600 space-y-1 ml-3 mb-3">
                  {item.details.map((detail, i) => (
                    <li key={i} className="list-disc">
                      {detail}
                    </li>
                  ))}
                </ul>
              )}

              {item.platforms && (
                <div className="space-y-3 mt-3">
                  {item.platforms.map((platform, pIdx) => (
                    <div key={pIdx} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                      <div className="text-xs font-semibold text-gray-700 mb-2">{platform.name}</div>
                      <ul className="text-xs text-gray-600 space-y-1 ml-3">
                        {platform.criteria.map((criterion, cIdx) => (
                          <li key={cIdx} className="list-disc">
                            {criterion}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
