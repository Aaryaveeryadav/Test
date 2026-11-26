declare module 'pdf-parse/lib/pdf-parse.js' {
  interface PdfParseResult {
    numpages: number
    numrender: number
    info: unknown
    metadata: unknown
    version: unknown
    text: string
  }
  function pdfParse(buffer: Buffer, options?: Record<string, unknown>): Promise<PdfParseResult>
  export default pdfParse
}
