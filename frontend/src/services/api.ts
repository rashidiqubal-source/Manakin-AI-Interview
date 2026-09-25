const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

interface RequestOptions extends RequestInit {
  timeout?: number;
  retries?: number;
}

async function fetchWithRetry(url: string, options: RequestOptions = {}): Promise<any> {
  const { timeout, retries = 2, ...fetchOptions } = options;
  const fullUrl = url.startsWith('http') ? url : `${BASE_URL}${url}`;

  fetchOptions.credentials = 'include';

  fetchOptions.headers = {
    'X-Requested-With': 'XMLHttpRequest',
    ...(fetchOptions.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...fetchOptions.headers,
  };

  let attempt = 0;
  while (true) {
    let controller: AbortController | undefined;
    let timer: NodeJS.Timeout | undefined;

    if (timeout && !fetchOptions.signal) {
      controller = new AbortController();
      fetchOptions.signal = controller.signal;
      timer = setTimeout(() => controller?.abort(), timeout);
    }

    try {
      const res = await fetch(fullUrl, fetchOptions);
      if (timer) clearTimeout(timer);

      if (!res.ok) {
        if (attempt < retries && (res.status >= 500 || res.status === 429)) {
          attempt++;
          await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 200));
          continue;
        }
        const errorData = await res.json().catch(() => ({ message: res.statusText }));
        const err = new Error(errorData.message || `HTTP Error ${res.status}`);
        (err as any).response = { status: res.status, data: errorData };
        throw err;
      }
      return await res.json();
    } catch (err: any) {
      if (timer) clearTimeout(timer);
      if (attempt < retries && (err.name === 'AbortError' || err.name === 'TypeError')) {
        attempt++;
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 200));
        continue;
      }
      throw err;
    }
  }
}

export const request = {
  get: (url: string, options?: RequestOptions) => fetchWithRetry(url, { method: 'GET', ...options }),
  post: (url: string, body?: any, options?: RequestOptions) => {
    const isFormData = body instanceof FormData;
    return fetchWithRetry(url, {
      method: 'POST',
      body: isFormData ? body : JSON.stringify(body),
      ...options,
    });
  },
};

// ── Authentication API ───────────────────────────────────────────
export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  role: 'RECRUITER' | 'APPLICANT';
  emailVerified: boolean;
  createdAt: string;
}

export const signupAPI = async (payload: { email: string; password: string; name?: string; role?: 'RECRUITER' | 'APPLICANT' }) => {
  return request.post('/auth/signup', payload);
};

export const signupApplicantAPI = async (payload: { email: string; password: string; name?: string }) => {
  return request.post('/auth/signup/applicant', payload);
};

export const signupRecruiterAPI = async (payload: { email: string; password: string; name?: string }) => {
  return request.post('/auth/signup/recruiter', payload);
};

export const signinAPI = async (payload: { email: string; password: string }) => {
  return request.post('/auth/signin', payload);
};

export const signoutAPI = async () => {
  return request.post('/auth/signout');
};

export const getMeAPI = async (): Promise<UserProfile> => {
  const data = await request.get('/auth/me');
  return data.data.user;
};

export const verifyEmailAPI = async (token: string) => {
  return request.post('/auth/verify-email', { token });
};

export const resendVerificationAPI = async (email: string) => {
  return request.post('/auth/resend-verification', { email });
};

export const forgotPasswordAPI = async (email: string) => {
  return request.post('/auth/forgot-password', { email });
};

export const resetPasswordAPI = async (payload: { token: string; newPassword: string }) => {
  return request.post('/auth/reset-password', payload);
};

// ── Interview & Audio APIs ───────────────────────────────────────
export const startInterviewAPI = async (candidateName: string, candidateEmail?: string, isDemo?: boolean) => {
  const data = await request.post('/interview/start', { candidateName, candidateEmail, isDemo });
  return data.data;
};

export const respondInterviewAPI = async (
  sessionId: string,
  text: string,
  silenceDurationSec?: number,
  ttsDurationSec?: number,
  codeSubmission?: {
    code: string;
    language?: string;
    challengeId?: string;
    repoName?: string;
  }
) => {
  if (!sessionId) {
    throw new Error('Session ID is missing or invalid.');
  }
  const data = await request.post('/interview/respond', {
    sessionId,
    text,
    silenceDurationSec,
    ttsDurationSec,
    codeSubmission,
  });
  return data.data;
};

export const evaluateInterviewAPI = async (
  sessionId: string,
  videoEngagementScore?: number,
  cheatFlags?: string[],
  eyeTrackingTelemetry?: any
) => {
  const data = await request.post('/interview/evaluate', {
    sessionId,
    videoEngagementScore,
    cheatFlags,
    eyeTrackingTelemetry,
  });
  return data.data;
};

export const concludeEarlyAPI = async (sessionId: string, reason?: string) => {
  const data = await request.post('/interview/conclude-early', { sessionId, reason });
  return data.data;
};

export const generateTTSAPI = async (text: string, voice = 'af_heart', speed = 1.0) => {
  const data = await request.post('/interview/tts', { text, voice, speed });
  return data;
};

export const transcribeAudioAPI = async (audioBlob: Blob) => {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'recording.webm');

  const data = await request.post('/voice/input', formData);
  return data.data.transcript;
};

export const submitFeedbackAPI = async (sessionId: string, feedback: string) => {
  const data = await request.post('/interview/feedback', { sessionId, feedback });
  return data.data;
};

export const getCandidateSessionsAPI = async (email: string) => {
  const data = await request.get(`/interview/candidate/sessions/${encodeURIComponent(email)}`);
  return data.data;
};

export const getCandidatesAPI = async (recruiterId?: string) => {
  const url = recruiterId ? `/admin/candidates?recruiterId=${encodeURIComponent(recruiterId)}` : '/admin/candidates';
  const data = await request.get(url);
  return data.data;
};

export const updateApplicationStatusAPI = async (sessionId: string, status: 'ACCEPTED' | 'REJECTED', feedbackReason?: string) => {
  const data = await request.post('/admin/status', { sessionId, status, feedbackReason });
  return data.data;
};

export const sendProctoringFrameAPI = async (sessionId?: string | null, base64Frame?: string) => {
  const data = await request.post('/interview/proctor/frame', {
    sessionId: sessionId || undefined,
    image: base64Frame,
  });
  return data.data;
};

export interface MLDetectionResponse {
  success: boolean;
  timestamp: number;
  processingTimeMs: number;
  faces: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    confidence: number;
  }>;
  objects: Array<{
    class: string;
    confidence: number;
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
  error?: string;
}

export const detectMLFrameAPI = async (base64Image: string, signal?: AbortSignal): Promise<MLDetectionResponse> => {
  return request.post('/ml/detect', { image: base64Image }, { signal, timeout: 2500 });
};

export const checkMLHealthAPI = async (): Promise<{ status: string; faceModel: boolean; objectModel: boolean }> => {
  return request.get('/ml/health', { timeout: 3000 });
};

// ── Recruiter API ────────────────────────────────────────────────
export const createStructuredJDAPI = async (payload: Record<string, any>) => {
  const data = await request.post('/recruiter/jd/create', payload);
  return data.data;
};

export const uploadJDAPI = async (title: string, content: string, recruiterId?: string) => {
  const data = await request.post('/recruiter/jd/upload', { title, content, recruiterId });
  return data.data;
};

export const uploadJDFileAPI = async (file: File, title?: string, recruiterId?: string) => {
  const formData = new FormData();
  formData.append('file', file);
  if (title) formData.append('title', title);
  if (recruiterId) formData.append('recruiterId', recruiterId);

  const data = await request.post('/recruiter/jd/upload-file', formData);
  return data.data;
};

export const uploadJDStage1API = async (payload: { file?: File; content?: string; title?: string; recruiterId?: string }) => {
  if (payload.file) {
    const formData = new FormData();
    formData.append('file', payload.file);
    if (payload.title) formData.append('title', payload.title);
    if (payload.recruiterId) formData.append('recruiterId', payload.recruiterId);
    const data = await request.post('/recruiter/jd/upload-stage1', formData);
    return data.data;
  }
  const data = await request.post('/recruiter/jd/upload-stage1', payload);
  return data.data;
};

export const finalizeJDStage2API = async (payload: { jobDescriptionId: string; answers: Array<{ number: number; answer: string }>; recruiterId?: string }) => {
  const data = await request.post('/recruiter/jd/stage2-finalize', payload);
  return data.data;
};

export const getRecruiterJDsAPI = async (recruiterId: string) => {
  const data = await request.get(`/recruiter/jds/${recruiterId}`);
  return data.data;
};

export const sendInvitationAPI = async (jobDescriptionId: string, applicantEmail: string, recruiterId?: string) => {
  const data = await request.post('/recruiter/invite', { jobDescriptionId, applicantEmail, recruiterId });
  return data.data;
};

export const getRecruiterInvitationsAPI = async (recruiterId: string) => {
  const data = await request.get(`/recruiter/invitations/${recruiterId}`);
  return data.data;
};

export const getEvidenceReportAPI = async (sessionId: string) => {
  const data = await request.get(`/recruiter/interview/${sessionId}/evidence-report`);
  return data.data;
};

export const getExplainableReportAPI = async (sessionId: string) => {
  const data = await request.get(`/interview/session/${sessionId}/explainable-report`);
  return data.data;
};

// ── Applicant & Invitation API ───────────────────────────────────
export const uploadResumeAPI = async (file: File, applicantId?: string, invitationToken?: string) => {
  const formData = new FormData();
  formData.append('resume', file);
  if (applicantId) formData.append('applicantId', applicantId);
  if (invitationToken) formData.append('invitationToken', invitationToken);

  const data = await request.post('/applicant/resume/upload', formData);
  return data.data;
};

export const getApplicantInvitationsAPI = async (applicantId: string) => {
  const data = await request.get(`/applicant/invitations/${applicantId}`);
  return data.data;
};

export const startInvitedInterviewAPI = async (invitationId: string, candidateName?: string, candidateEmail?: string, githubUrl?: string) => {
  const data = await request.post('/applicant/interview/start', { invitationId, candidateName, candidateEmail, githubUrl });
  return data.data;
};

export const recordInterviewExitAPI = async (invitationId: string, sessionId?: string | null) => {
  const data = await request.post('/applicant/interview/exit', { invitationId, sessionId });
  return data;
};

export const getInvitationByTokenAPI = async (token: string) => {
  const data = await request.get(`/invitation/${token}`);
  return data.data;
};

export const claimInvitationAPI = async (token: string, applicantId?: string) => {
  const data = await request.post(`/invitation/${token}/claim`, { applicantId });
  return data.data;
};

export const getJDBlueprintAPI = async (jobDescriptionId: string) => {
  const data = await request.get(`/recruiter/jd/${jobDescriptionId}/blueprint`);
  return data.data;
};

export const generateQuestionsAPI = async (payload: {
  jobDescriptionId?: string;
  applicantResumeId?: string;
  normalizedJD?: any;
  normalizedResume?: any;
  candidateName?: string;
}) => {
  const data = await request.post('/interview/questions/generate', payload);
  return data.data;
};
