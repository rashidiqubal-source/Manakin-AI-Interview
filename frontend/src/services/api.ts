import axios from 'axios';
import axiosRetry from 'axios-retry';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  withCredentials: true, // Automatically sends and receives HttpOnly session cookies
  headers: {
    'Content-Type': 'application/json',
  },
});

axiosRetry(apiClient, {
  retries: 2,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => {
    // Retry on network errors or 5xx server errors
    return axiosRetry.isNetworkOrIdempotentRequestError(error) || error.response?.status === 500;
  },
});

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
  const { data } = await apiClient.post('/auth/signup', payload);
  return data;
};

export const signupApplicantAPI = async (payload: { email: string; password: string; name?: string }) => {
  const { data } = await apiClient.post('/auth/signup/applicant', payload);
  return data;
};

export const signupRecruiterAPI = async (payload: { email: string; password: string; name?: string }) => {
  const { data } = await apiClient.post('/auth/signup/recruiter', payload);
  return data;
};

export const signinAPI = async (payload: { email: string; password: string }) => {
  const { data } = await apiClient.post('/auth/signin', payload);
  return data;
};

export const signoutAPI = async () => {
  const { data } = await apiClient.post('/auth/signout');
  return data;
};

export const getMeAPI = async (): Promise<UserProfile> => {
  const { data } = await apiClient.get('/auth/me');
  return data.data.user;
};

export const verifyEmailAPI = async (token: string) => {
  const { data } = await apiClient.post('/auth/verify-email', { token });
  return data;
};

export const resendVerificationAPI = async (email: string) => {
  const { data } = await apiClient.post('/auth/resend-verification', { email });
  return data;
};

export const forgotPasswordAPI = async (email: string) => {
  const { data } = await apiClient.post('/auth/forgot-password', { email });
  return data;
};

export const resetPasswordAPI = async (payload: { token: string; newPassword: string }) => {
  const { data } = await apiClient.post('/auth/reset-password', payload);
  return data;
};

// ── Interview & Audio APIs ───────────────────────────────────────
export const startInterviewAPI = async (candidateName: string, candidateEmail?: string) => {
  const { data } = await apiClient.post('/interview/start', { candidateName, candidateEmail });
  return data.data;
};

export const respondInterviewAPI = async (sessionId: string, text: string) => {
  if (!sessionId) {
    throw new Error('Session ID is missing or invalid.');
  }
  const { data } = await apiClient.post('/interview/respond', { sessionId, text });
  return data.data;
};

export const evaluateInterviewAPI = async (sessionId: string, videoEngagementScore?: number, cheatFlags?: string[]) => {
  const { data } = await apiClient.post('/interview/evaluate', { sessionId, videoEngagementScore, cheatFlags });
  return data.data;
};

export const transcribeAudioAPI = async (audioBlob: Blob) => {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'recording.webm');

  const { data } = await apiClient.post('/voice/input', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.data.transcript;
};

export const submitFeedbackAPI = async (sessionId: string, feedback: string) => {
  const { data } = await apiClient.post('/interview/feedback', { sessionId, feedback });
  return data.data;
};

export const getCandidateSessionsAPI = async (email: string) => {
  const { data } = await apiClient.get(`/interview/candidate/sessions/${encodeURIComponent(email)}`);
  return data.data;
};

export const getCandidatesAPI = async (recruiterId?: string) => {
  const url = recruiterId ? `/admin/candidates?recruiterId=${encodeURIComponent(recruiterId)}` : '/admin/candidates';
  const { data } = await apiClient.get(url);
  return data.data;
};

export const updateApplicationStatusAPI = async (sessionId: string, status: 'ACCEPTED' | 'REJECTED', feedbackReason?: string) => {
  const { data } = await apiClient.post('/admin/status', { sessionId, status, feedbackReason });
  return data.data;
};


export const sendProctoringFrameAPI = async (sessionId?: string | null, base64Frame?: string) => {
  const { data } = await apiClient.post('/interview/proctor/frame', {
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
  const { data } = await apiClient.post<MLDetectionResponse>(
    '/ml/detect',
    { image: base64Image },
    { signal, timeout: 2500 }
  );
  return data;
};

export const checkMLHealthAPI = async (): Promise<{ status: string; faceModel: boolean; objectModel: boolean }> => {
  const { data } = await apiClient.get('/ml/health', { timeout: 3000 });
  return data;
};

// ── Recruiter API ────────────────────────────────────────────────
export const createStructuredJDAPI = async (payload: Record<string, any>) => {
  const { data } = await apiClient.post('/recruiter/jd/create', payload);
  return data.data;
};

export const uploadJDAPI = async (title: string, content: string, recruiterId?: string) => {
  const { data } = await apiClient.post('/recruiter/jd/upload', { title, content, recruiterId });
  return data.data;
};

export const getRecruiterJDsAPI = async (recruiterId: string) => {
  const { data } = await apiClient.get(`/recruiter/jds/${recruiterId}`);
  return data.data;
};

export const sendInvitationAPI = async (jobDescriptionId: string, applicantEmail: string, recruiterId?: string) => {
  const { data } = await apiClient.post('/recruiter/invite', { jobDescriptionId, applicantEmail, recruiterId });
  return data.data;
};

export const getRecruiterInvitationsAPI = async (recruiterId: string) => {
  const { data } = await apiClient.get(`/recruiter/invitations/${recruiterId}`);
  return data.data;
};

// ── Applicant & Invitation API ───────────────────────────────────
export const uploadResumeAPI = async (file: File, applicantId?: string, invitationToken?: string) => {
  const formData = new FormData();
  formData.append('resume', file);
  if (applicantId) formData.append('applicantId', applicantId);
  if (invitationToken) formData.append('invitationToken', invitationToken);

  const { data } = await apiClient.post('/applicant/resume/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.data;
};

export const getApplicantInvitationsAPI = async (applicantId: string) => {
  const { data } = await apiClient.get(`/applicant/invitations/${applicantId}`);
  return data.data;
};

export const startInvitedInterviewAPI = async (invitationId: string, candidateName?: string, candidateEmail?: string) => {
  const { data } = await apiClient.post('/applicant/interview/start', { invitationId, candidateName, candidateEmail });
  return data.data;
};

export const getInvitationByTokenAPI = async (token: string) => {
  const { data } = await apiClient.get(`/invitation/${token}`);
  return data.data;
};

export const claimInvitationAPI = async (token: string, applicantId?: string) => {
  const { data } = await apiClient.post(`/invitation/${token}/claim`, { applicantId });
  return data.data;
};

export const getJDBlueprintAPI = async (jobDescriptionId: string) => {
  const { data } = await apiClient.get(`/recruiter/jd/${jobDescriptionId}/blueprint`);
  return data.data;
};

export const generateQuestionsAPI = async (payload: {
  jobDescriptionId?: string;
  applicantResumeId?: string;
  normalizedJD?: any;
  normalizedResume?: any;
  candidateName?: string;
}) => {
  const { data } = await apiClient.post('/interview/questions/generate', payload);
  return data.data;
};
