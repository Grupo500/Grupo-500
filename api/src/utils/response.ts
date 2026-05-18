import { Response } from 'express'

const MAX_PAGE_LIMIT = 100

/** Sanitiza y limita los parámetros de paginación de query params */
export function parsePagination(query: Record<string, unknown>) {
  const page  = Math.max(1, Number(query.page)  || 1)
  const limit = Math.min(MAX_PAGE_LIMIT, Math.max(1, Number(query.limit) || 20))
  const skip  = (page - 1) * limit
  return { page, limit, skip }
}

export const ApiResponse = {
  success<T>(res: Response, data: T, statusCode = 200) {
    return res.status(statusCode).json({ success: true, data })
  },

  created<T>(res: Response, data: T) {
    return res.status(201).json({ success: true, data })
  },

  noContent(res: Response) {
    return res.status(204).send()
  },

  error(res: Response, message: string, statusCode = 500) {
    return res.status(statusCode).json({ success: false, error: message })
  },

  paginated<T>(res: Response, data: T[], total: number, page: number, limit: number) {
    return res.json({
      success: true,
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    })
  },
}
