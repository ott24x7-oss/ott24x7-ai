import type { DiagnosticProcessingStatus } from '@shared/data/types/diagnosticReport'
import type { DiagnosticUploadFailureReason } from '@shared/ipc/schemas/diagnostics'
import type { AbsoluteFilePath } from '@shared/types/file'
import { DIAGNOSTIC_REPORT_BASE_URL } from '@shared/utils/diagnostics'

export const DIAGNOSTIC_UPLOAD_URL = DIAGNOSTIC_REPORT_BASE_URL

export type CherryDiagnosticUploadFailureReason = DiagnosticUploadFailureReason

export type CherryDiagnosticUploadResult =
  | {
      status: 'uploaded'
      reportId: string
      processingStatus: DiagnosticProcessingStatus | null
      submittedAt?: number
    }
  | { status: 'rejected'; reason: CherryDiagnosticUploadFailureReason; fileSha256?: string }
  | { status: 'submission_unknown'; fileSha256: string }

export interface CherryDiagnosticUploadInput {
  description: string
  expectedFileSha256?: string
  fileName: string
  filePath: AbsoluteFilePath
}

export class CherryDiagnosticUploadClient {
  async fetchStatus(_reportId: string): Promise<DiagnosticProcessingStatus> {
    void _reportId
    throw new Error('Remote diagnostic reports are disabled in this build.')
  }

  async upload(_input: CherryDiagnosticUploadInput): Promise<CherryDiagnosticUploadResult> {
    void _input
    return { status: 'rejected', reason: 'service_unavailable' }
  }
}

export const cherryDiagnosticUploadClient = new CherryDiagnosticUploadClient()
