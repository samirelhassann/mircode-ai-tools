import path from 'node:path'
import { readFile } from 'node:fs/promises'
import type {
  DiscoveryNode,
  DrawingNode,
  FeatureNode,
  Status,
  TaskNode,
  TreeResponse,
} from './types.js'
import { dirExists, fileExists, readText } from './fs-utils.js'
import {
  extractDiscoveryFrontmatterFields,
  extractDrawingFrontmatterFields,
  extractFrontmatterFields,
  parseFrontmatter,
} from './frontmatter.js'

type FeatureMetaRaw = {
  title?: unknown
  description?: unknown
  icon?: unknown
  pages?: unknown
}

type RootMetaRaw = {
  title?: unknown
  pages?: unknown
}

function aggregateStatus(children: Status[]): Status {
  if (children.length === 0) return 'pending'
  if (children.some((s) => s === 'blocked')) return 'blocked'
  if (children.every((s) => s === 'completed')) return 'completed'
  if (children.some((s) => s === 'in-progress' || s === 'completed')) return 'in-progress'
  return 'pending'
}

export async function buildTree(
  projectRoot: string,
  featuresDir: string,
  discoveriesDir: string,
  drawingsDir: string,
): Promise<TreeResponse> {
  const featuresAbs = path.join(projectRoot, featuresDir)
  const rootMetaPath = path.join(featuresAbs, 'meta.json')
  if (!(await fileExists(rootMetaPath))) {
    throw new Error('no_features_dir')
  }

  const rootRaw = await readFile(rootMetaPath, 'utf8')
  const rootMeta = JSON.parse(rootRaw) as RootMetaRaw
  const rootPages = Array.isArray(rootMeta.pages) ? (rootMeta.pages as unknown[]) : []

  const features: FeatureNode[] = []

  for (const slugUnknown of rootPages) {
    if (typeof slugUnknown !== 'string') continue
    const slug = slugUnknown
    const featureDir = path.join(featuresAbs, slug)
    const featureMetaPath = path.join(featureDir, 'meta.json')

    if (!(await dirExists(featureDir)) || !(await fileExists(featureMetaPath))) {
      console.warn(
        `[tree] feature "${slug}" listada em ${featuresDir}/meta.json mas sem pasta/meta — ignorando conteúdo.`,
      )
      features.push({
        slug,
        title: slug,
        status: 'pending',
        tasks: [],
      })
      continue
    }

    let featureMeta: FeatureMetaRaw
    try {
      featureMeta = JSON.parse(await readText(featureMetaPath)) as FeatureMetaRaw
    } catch (err) {
      console.warn(`[tree] meta.json inválido em ${featureMetaPath}: ${(err as Error).message}`)
      featureMeta = {}
    }

    const title = typeof featureMeta.title === 'string' ? featureMeta.title : slug
    const description =
      typeof featureMeta.description === 'string' ? featureMeta.description : undefined
    const icon = typeof featureMeta.icon === 'string' ? featureMeta.icon : undefined
    const pages = Array.isArray(featureMeta.pages) ? (featureMeta.pages as unknown[]) : []

    const tasks: TaskNode[] = []
    for (const pageUnknown of pages) {
      if (typeof pageUnknown !== 'string') continue
      const pageSlug = pageUnknown
      const taskFile = path.join(featureDir, `${pageSlug}.md`)
      if (!(await fileExists(taskFile))) {
        console.warn(
          `[tree] task "${pageSlug}" listada em ${slug}/meta.json mas sem arquivo — omitindo.`,
        )
        continue
      }
      let raw: string
      try {
        raw = await readText(taskFile)
      } catch {
        continue
      }
      const parsed = parseFrontmatter(raw)
      const {
        title: taskTitle,
        description: taskDescription,
        status,
      } = extractFrontmatterFields(parsed.data)
      tasks.push({
        slug: pageSlug,
        title: taskTitle ?? pageSlug,
        description: taskDescription,
        status,
        file: path.relative(projectRoot, taskFile),
      })
    }

    features.push({
      slug,
      title,
      description,
      icon,
      status: aggregateStatus(tasks.map((t) => t.status)),
      tasks,
    })
  }

  const discoveries = await buildDiscoveries(projectRoot, discoveriesDir)
  const drawings = await buildDrawings(projectRoot, drawingsDir)

  return { features, discoveries, drawings }
}

/**
 * Lê uma seção "plana" — uma pasta de `.md` sem subpastas, ordenada pelo `pages`
 * do `meta.json`. Discoveries e desenhos têm exatamente essa forma; só mudam os
 * campos que cada um extrai do frontmatter.
 */
async function buildFlatSection<T>(
  projectRoot: string,
  dir: string,
  kind: string,
  toNode: (slug: string, data: Record<string, unknown>, file: string) => T,
): Promise<T[]> {
  const abs = path.join(projectRoot, dir)
  const metaPath = path.join(abs, 'meta.json')
  if (!(await dirExists(abs)) || !(await fileExists(metaPath))) {
    return []
  }

  let meta: RootMetaRaw
  try {
    meta = JSON.parse(await readText(metaPath)) as RootMetaRaw
  } catch (err) {
    console.warn(`[tree] meta.json inválido em ${metaPath}: ${(err as Error).message}`)
    return []
  }

  const pages = Array.isArray(meta.pages) ? (meta.pages as unknown[]) : []
  const nodes: T[] = []
  for (const pageUnknown of pages) {
    if (typeof pageUnknown !== 'string') continue
    const pageSlug = pageUnknown
    const file = path.join(abs, `${pageSlug}.md`)
    if (!(await fileExists(file))) {
      console.warn(
        `[tree] ${kind} "${pageSlug}" listada em ${dir}/meta.json mas sem arquivo — omitindo.`,
      )
      continue
    }
    let raw: string
    try {
      raw = await readText(file)
    } catch {
      continue
    }
    const parsed = parseFrontmatter(raw)
    nodes.push(toNode(pageSlug, parsed.data, path.relative(projectRoot, file)))
  }
  return nodes
}

export async function buildDiscoveries(
  projectRoot: string,
  discoveriesDir: string,
): Promise<DiscoveryNode[]> {
  return buildFlatSection(projectRoot, discoveriesDir, 'discovery', (slug, data, file) => {
    const { title, type, date } = extractDiscoveryFrontmatterFields(data)
    return { slug, title: title ?? slug, type, date, file }
  })
}

export async function buildDrawings(
  projectRoot: string,
  drawingsDir: string,
): Promise<DrawingNode[]> {
  return buildFlatSection(projectRoot, drawingsDir, 'desenho', (slug, data, file) => {
    const { title, type, date } = extractDrawingFrontmatterFields(data)
    return { slug, title: title ?? slug, type, date, file }
  })
}

export { aggregateStatus }
