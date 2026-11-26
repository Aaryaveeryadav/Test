import { z } from 'zod'

/**
 * Structured diagram schema. The model may only produce data in this shape;
 * the renderer builds SVG from the validated data. Arbitrary model HTML/SVG is
 * never rendered — this is what keeps diagrams safe.
 */
export const DiagramSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('geometry'),
    title: z.string().min(1).max(120),
    alt: z.string().min(1).max(600),
    points: z
      .array(
        z.object({
          id: z.string().min(1).max(8),
          x: z.number().min(0).max(1000),
          y: z.number().min(0).max(1000),
          label: z.string().max(40).optional()
        })
      )
      .min(2)
      .max(24),
    segments: z
      .array(
        z.object({
          from: z.string(),
          to: z.string(),
          label: z.string().max(40).optional(),
          dashed: z.boolean().optional()
        })
      )
      .max(40)
      .default([]),
    right_angles: z.array(z.object({ at: z.string() })).max(8).default([])
  }),
  z.object({
    type: z.literal('graph'),
    title: z.string().min(1).max(120),
    alt: z.string().min(1).max(600),
    x_label: z.string().max(40).default('x'),
    y_label: z.string().max(40).default('y'),
    x_min: z.number().default(0),
    x_max: z.number().default(10),
    y_min: z.number().default(0),
    y_max: z.number().default(10),
    series: z
      .array(
        z.object({
          label: z.string().max(60).default(''),
          points: z.array(z.object({ x: z.number(), y: z.number() })).min(2).max(120),
          dashed: z.boolean().optional()
        })
      )
      .min(1)
      .max(6)
  }),
  z.object({
    type: z.literal('timeline'),
    title: z.string().min(1).max(120),
    alt: z.string().min(1).max(600),
    events: z
      .array(z.object({ when: z.string().max(60), label: z.string().max(120) }))
      .min(2)
      .max(10)
  }),
  z.object({
    type: z.literal('concept_map'),
    title: z.string().min(1).max(120),
    alt: z.string().min(1).max(600),
    nodes: z
      .array(z.object({ id: z.string().min(1).max(12), label: z.string().min(1).max(60) }))
      .min(2)
      .max(12),
    edges: z
      .array(z.object({ from: z.string(), to: z.string(), label: z.string().max(60).optional() }))
      .max(20)
  }),
  z.object({
    type: z.literal('circuit'),
    title: z.string().min(1).max(120),
    alt: z.string().min(1).max(600),
    nodes: z
      .array(z.object({ id: z.string().min(1).max(12), label: z.string().max(60).optional() }))
      .min(2)
      .max(16),
    edges: z
      .array(
        z.object({
          from: z.string(),
          to: z.string(),
          component: z.enum(['wire', 'battery', 'resistor', 'bulb', 'switch']).default('wire'),
          label: z.string().max(40).optional()
        })
      )
      .min(1)
      .max(24)
  })
])

export type DiagramData = z.infer<typeof DiagramSchema>

export function parseDiagram(value: unknown): DiagramData | null {
  const result = DiagramSchema.safeParse(value)
  return result.success ? result.data : null
}
