"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { motion, AnimatePresence } from "framer-motion";
import { 
  Building2, Briefcase, FileText, ListCheck, Code2, Clock, 
  GraduationCap, Star, UserCheck, CheckCircle2, ArrowLeft, ArrowRight, 
  Plus, Trash2, Save, Sparkles, Check, ChevronRight, HelpCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { createStructuredJDAPI } from "@/services/api";
import { useAuthStore } from "@/lib/authStore";

const STEPS = [
  { id: 1, name: "Job Basics", icon: Building2, desc: "Title, Department & Work Mode" },
  { id: 2, name: "Job Details", icon: FileText, desc: "Summary & Description" },
  { id: 3, name: "Responsibilities", icon: ListCheck, desc: "Primary Duties & Work" },
  { id: 4, name: "Required Skills", icon: Code2, desc: "Technical Skills & Proficiency" },
  { id: 5, name: "Experience", icon: Clock, desc: "Years & Industry Requirements" },
  { id: 6, name: "Education", icon: GraduationCap, desc: "Degrees & Certifications" },
  { id: 7, name: "Preferred Skills", icon: Star, desc: "Nice-to-have & Extra Requirements" },
  { id: 8, name: "Candidate Qualities", icon: UserCheck, desc: "Qualities, Languages & Shifts" },
  { id: 9, name: "Final Review", icon: CheckCircle2, desc: "Review & Publish" },
];

export default function CreateJobDescriptionPage() {
  const router = useRouter();
  const { user, isInitialized } = useAuthStore();


  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    // Section 1: Job Basics
    title: "",
    department: "Engineering",
    jobLevel: "Mid Level",
    employmentType: "Full-time",
    openings: 1,
    location: "Remote",
    workMode: "Remote",
    joiningDate: "",

    // Section 2: About the Job
    shortSummary: "",
    rawContent: "",
    positionReason: "New Position",

    // Section 3: Responsibilities
    responsibilities: [
      "Develop and maintain backend APIs",
      "Design and optimize databases",
      "Participate in code reviews and architectural discussions"
    ],
    dayToDayWork: "",

    // Section 4: Required Skills
    requiredSkills: [
      { name: "Node.js", importance: "Must Have", proficiency: "Advanced" },
      { name: "PostgreSQL", importance: "Must Have", proficiency: "Intermediate" },
      { name: "TypeScript", importance: "Good to Have", proficiency: "Intermediate" }
    ],

    // Section 5: Experience
    minExperience: 2,
    maxExperience: 5,
    relevantExperience: "2+ years in Node.js / Express backend development",
    industryExperience: "Software Product / SaaS",
    freshersAllowed: false,
    fresherRequirements: ["Projects", "Internships"],

    // Section 6: Education
    minEducation: "Bachelor's",
    requiredDegree: "Computer Science or related IT field",
    cgpaRequirement: "6.5+ CGPA",
    certificationsRequired: "",

    // Section 7: Preferred Skills
    preferredSkills: ["AWS", "Docker", "Redis", "GraphQL"],
    preferredExperience: "Prior experience with microservices or real-time WebSockets",
    otherPreferredSkills: "",

    // Section 8: Candidate Requirements & Qualities
    candidateQualities: "Strong problem-solving ability, proactive communication skills, and practical backend development experience.",
    languagesRequired: ["English"],
    otherRequirements: "Work authorization, willingness to work in EST overlap hours.",
  });

  // Dynamic Skill input state
  const [newSkillName, setNewSkillName] = useState("");
  const [newSkillImportance, setNewSkillImportance] = useState("Must Have");
  const [newSkillProficiency, setNewSkillProficiency] = useState("Intermediate");

  // Dynamic Responsibility input state
  const [newRespInput, setNewRespInput] = useState("");

  // Dynamic Tag inputs
  const [newPrefSkillInput, setNewPrefSkillInput] = useState("");
  const [newLangInput, setNewLangInput] = useState("");

  useEffect(() => {
    if (isInitialized && !user) {
      router.push("/recruiter/sign-in");
    }
  }, [isInitialized, user, router]);


  const updateForm = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Step Validation logic
  const validateStep = (step: number): boolean => {
    if (step === 1) {
      if (!formData.title.trim()) {
        toast.error("Job Title is required (Step 1)");
        return false;
      }
    }
    if (step === 2) {
      if (!formData.shortSummary.trim()) {
        toast.error("Short Job Summary is required (Step 2)");
        return false;
      }
      if (!formData.rawContent.trim()) {
        toast.error("Detailed Job Description is required (Step 2)");
        return false;
      }
    }
    if (step === 3) {
      if (formData.responsibilities.length === 0) {
        toast.error("Please add at least one primary responsibility (Step 3)");
        return false;
      }
    }
    if (step === 4) {
      if (formData.requiredSkills.length === 0) {
        toast.error("Please add at least one required technical skill (Step 4)");
        return false;
      }
    }
    if (step === 8) {
      if (!formData.candidateQualities.trim()) {
        toast.error("Most Important Candidate Qualities is required (Step 8)");
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(STEPS.length, prev + 1));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(1, prev - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Add / Remove Handlers
  const addResponsibility = () => {
    if (newRespInput.trim()) {
      setFormData(prev => ({ ...prev, responsibilities: [...prev.responsibilities, newRespInput.trim()] }));
      setNewRespInput("");
    }
  };

  const removeResponsibility = (index: number) => {
    setFormData(prev => ({ ...prev, responsibilities: prev.responsibilities.filter((_, i) => i !== index) }));
  };

  const addRequiredSkill = () => {
    if (newSkillName.trim()) {
      setFormData(prev => ({
        ...prev,
        requiredSkills: [
          ...prev.requiredSkills,
          { name: newSkillName.trim(), importance: newSkillImportance, proficiency: newSkillProficiency }
        ]
      }));
      setNewSkillName("");
    }
  };

  const removeRequiredSkill = (index: number) => {
    setFormData(prev => ({ ...prev, requiredSkills: prev.requiredSkills.filter((_, i) => i !== index) }));
  };

  const addPreferredSkill = () => {
    if (newPrefSkillInput.trim()) {
      setFormData(prev => ({ ...prev, preferredSkills: [...prev.preferredSkills, newPrefSkillInput.trim()] }));
      setNewPrefSkillInput("");
    }
  };

  const removePreferredSkill = (index: number) => {
    setFormData(prev => ({ ...prev, preferredSkills: prev.preferredSkills.filter((_, i) => i !== index) }));
  };

  const addLanguage = () => {
    if (newLangInput.trim()) {
      setFormData(prev => ({ ...prev, languagesRequired: [...prev.languagesRequired, newLangInput.trim()] }));
      setNewLangInput("");
    }
  };

  const removeLanguage = (index: number) => {
    setFormData(prev => ({ ...prev, languagesRequired: prev.languagesRequired.filter((_, i) => i !== index) }));
  };

  const toggleFresherRequirement = (req: string) => {
    setFormData(prev => {
      const exists = prev.fresherRequirements.includes(req);
      return {
        ...prev,
        fresherRequirements: exists 
          ? prev.fresherRequirements.filter(r => r !== req)
          : [...prev.fresherRequirements, req]
      };
    });
  };

  // Submit & Save Draft
  const handleSave = async (isDraft: boolean) => {
    if (!isDraft && !validateStep(1)) return;
    if (!user) return;

    if (isDraft) setIsSavingDraft(true);
    else setIsSubmitting(true);

    try {
      const payload = {
        recruiterId: user.id,
        ...formData,
        isDraft
      };

      await createStructuredJDAPI(payload);

      toast.success(isDraft ? "Job Description saved as Draft!" : "Job Description published successfully!", {
        description: isDraft ? "You can edit and publish it anytime from your dashboard." : "Applicants can now be invited."
      });

      router.push("/recruiter");
    } catch (err: any) {
      console.error("Failed to save JD:", err);
      toast.error("Failed to save Job Description", { description: err?.response?.data?.message || err.message });
    } finally {
      setIsSubmitting(false);
      setIsSavingDraft(false);
    }
  };

  if (!isInitialized || !user) {
    return <div className="min-h-screen bg-black flex items-center justify-center text-white">Loading...</div>;
  }


  return (
    <div className="min-h-screen bg-black text-white py-10 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-violet-900/10 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-cyan-900/10 blur-[150px] rounded-full pointer-events-none" />

      <div className="max-w-4xl mx-auto space-y-6 relative z-10">

        {/* Top Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-zinc-900/40 backdrop-blur-xl p-6 rounded-2xl border border-white/5 shadow-2xl">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-widest text-violet-400">Recruiter Portal</span>
            <h1 className="text-2xl font-bold tracking-tight text-white mt-0.5">Create Job Description</h1>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => router.push("/recruiter")}
              className="border-zinc-800 text-zinc-300 hover:bg-white/5 text-xs h-10"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Dashboard
            </Button>
            <Button
              variant="outline"
              onClick={() => handleSave(true)}
              disabled={isSavingDraft}
              className="border-violet-500/30 text-violet-300 hover:bg-violet-500/10 text-xs h-10"
            >
              <Save className="w-3.5 h-3.5 mr-1.5" /> Save Draft
            </Button>
          </div>
        </div>

        {/* Step Progress Bar */}
        <div className="bg-zinc-950 p-4 rounded-2xl border border-white/5 space-y-3">
          <div className="flex justify-between items-center text-xs font-semibold">
            <span className="text-violet-400">Step {currentStep} of {STEPS.length}: <strong className="text-white">{STEPS[currentStep - 1].name}</strong></span>
            <span className="text-zinc-500 font-mono">{Math.round((currentStep / STEPS.length) * 100)}% Complete</span>
          </div>

          <div className="w-full bg-zinc-900 h-2 rounded-full overflow-hidden">
            <div 
              className="bg-gradient-to-r from-violet-600 to-cyan-500 h-full transition-all duration-300"
              style={{ width: `${(currentStep / STEPS.length) * 100}%` }}
            />
          </div>

          {/* Step Pill Navigation */}
          <div className="flex overflow-x-auto gap-2 pt-2 scrollbar-none">
            {STEPS.map((s) => {
              const Icon = s.icon;
              const isActive = s.id === currentStep;
              const isDone = s.id < currentStep;

              return (
                <button
                  key={s.id}
                  onClick={() => {
                    if (s.id <= currentStep || validateStep(currentStep)) {
                      setCurrentStep(s.id);
                    }
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                    isActive 
                      ? "bg-violet-600 text-white font-bold shadow-[0_0_15px_rgba(139,92,246,0.3)]" 
                      : isDone 
                      ? "bg-zinc-900 text-teal-400 border border-teal-500/20" 
                      : "bg-zinc-950 text-zinc-500 border border-zinc-800"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{s.id}. {s.name}</span>
                  {isDone && <Check className="w-3 h-3 text-teal-400" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Step Card Content */}
        <Card className="border border-white/10 bg-zinc-950 p-8 rounded-2xl shadow-2xl space-y-6">

          {/* STEP 1: Basic Job Information */}
          {currentStep === 1 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-violet-400" /> 1. Basic Job Information
                </h3>
                <p className="text-xs text-zinc-400 mt-1">Specify core job role metadata, department, level, and location settings.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">
                    Job Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Senior Backend Engineer / AI Researcher / Tutor"
                    value={formData.title}
                    onChange={(e) => updateForm("title", e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">Department</label>
                  <select
                    value={formData.department}
                    onChange={(e) => updateForm("department", e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500"
                  >
                    {["Engineering", "Product", "Design", "Marketing", "Sales", "HR", "Finance", "Education/Tutoring", "Customer Support", "Other"].map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">Job Level</label>
                  <select
                    value={formData.jobLevel}
                    onChange={(e) => updateForm("jobLevel", e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500"
                  >
                    {["Intern", "Entry Level", "Mid Level", "Senior", "Lead", "Manager", "Executive"].map((l) => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">Employment Type</label>
                  <select
                    value={formData.employmentType}
                    onChange={(e) => updateForm("employmentType", e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500"
                  >
                    {["Full-time", "Part-time", "Contract", "Internship"].map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">Number of Openings</label>
                  <input
                    type="number"
                    min={1}
                    value={formData.openings}
                    onChange={(e) => updateForm("openings", parseInt(e.target.value) || 1)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">Work Mode</label>
                  <select
                    value={formData.workMode}
                    onChange={(e) => updateForm("workMode", e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500"
                  >
                    {["On-site", "Hybrid", "Remote"].map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">Job Location</label>
                  <input
                    type="text"
                    placeholder="e.g. San Francisco, CA / Remote (US & Canada)"
                    value={formData.location}
                    onChange={(e) => updateForm("location", e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">Expected Joining Date</label>
                  <input
                    type="text"
                    placeholder="e.g. Immediate / Next 30 Days / Oct 15, 2026"
                    value={formData.joiningDate}
                    onChange={(e) => updateForm("joiningDate", e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 2: About the Job */}
          {currentStep === 2 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-violet-400" /> 2. About the Job
                </h3>
                <p className="text-xs text-zinc-400 mt-1">Provide short executive summaries and detailed job descriptions for candidates and AI evaluation.</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">
                    Short Job Summary <span className="text-rose-500">*</span>
                  </label>
                  <p className="text-[11px] text-zinc-500 mb-1">A concise 2-3 sentence overview highlighting what makes this role unique.</p>
                  <textarea
                    rows={3}
                    placeholder="e.g. We are seeking an experienced Backend Engineer to lead our real-time messaging pipeline, optimize high-throughput PostgreSQL databases, and build scalable Node.js microservices."
                    value={formData.shortSummary}
                    onChange={(e) => updateForm("shortSummary", e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 text-sm text-white focus:outline-none focus:border-violet-500 leading-relaxed"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">
                    Detailed Job Description <span className="text-rose-500">*</span>
                  </label>
                  <p className="text-[11px] text-zinc-500 mb-1">Full text describing team context, expectations, tech stack, and goals.</p>
                  <textarea
                    rows={8}
                    placeholder="Paste full job description text here..."
                    value={formData.rawContent}
                    onChange={(e) => updateForm("rawContent", e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-sm text-white focus:outline-none focus:border-violet-500 leading-relaxed font-sans"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">Why is this position open?</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {["New Position", "Replacement", "Business Expansion", "Other"].map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => updateForm("positionReason", r)}
                        className={`p-3 rounded-xl text-xs font-semibold border transition-all text-center ${
                          formData.positionReason === r
                            ? "bg-violet-600/20 border-violet-500 text-violet-300"
                            : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white"
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 3: Responsibilities */}
          {currentStep === 3 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <ListCheck className="w-5 h-5 text-violet-400" /> 3. Responsibilities
                </h3>
                <p className="text-xs text-zinc-400 mt-1">Add primary duties dynamically. Each responsibility represents a separate item for candidate scoring.</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-2">
                    Primary Responsibilities <span className="text-rose-500">*</span>
                  </label>

                  <div className="flex gap-2 mb-3">
                    <input
                      type="text"
                      placeholder="e.g. Develop and maintain backend APIs with Node.js & TypeScript"
                      value={newRespInput}
                      onChange={(e) => setNewRespInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addResponsibility(); } }}
                      className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500"
                    />
                    <Button type="button" onClick={addResponsibility} className="bg-violet-600 hover:bg-violet-500 text-xs px-4">
                      <Plus className="w-4 h-4 mr-1" /> Add
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {formData.responsibilities.map((resp, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-zinc-900/60 border border-zinc-800 px-4 py-3 rounded-xl text-xs text-zinc-200">
                        <span className="flex items-center gap-2">
                          <span className="h-5 w-5 bg-violet-500/20 text-violet-400 font-bold rounded-md flex items-center justify-center text-[10px]">{idx + 1}</span>
                          {resp}
                        </span>
                        <button type="button" onClick={() => removeResponsibility(idx)} className="text-zinc-500 hover:text-rose-400 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">Day-to-Day Work (Optional)</label>
                  <textarea
                    rows={3}
                    placeholder="Describe what a typical day looks like (e.g., Morning standup, sprint tasks, code reviews, debugging)..."
                    value={formData.dayToDayWork}
                    onChange={(e) => updateForm("dayToDayWork", e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 text-sm text-white focus:outline-none focus:border-violet-500 leading-relaxed"
                  />
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 4: Required Skills */}
          {currentStep === 4 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Code2 className="w-5 h-5 text-violet-400" /> 4. Required Technical Skills
                </h3>
                <p className="text-xs text-zinc-400 mt-1">Add technical skills along with their importance (Must Have vs Good to Have) and expected proficiency level.</p>
              </div>

              <div className="space-y-4">
                {/* Skill Add Bar */}
                <div className="bg-zinc-900/60 p-4 rounded-xl border border-zinc-800 space-y-3">
                  <span className="text-xs font-semibold text-violet-400 uppercase tracking-wider block">Add New Required Skill</span>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <input
                      type="text"
                      placeholder="Skill Name (e.g. Node.js, Docker, Python)"
                      value={newSkillName}
                      onChange={(e) => setNewSkillName(e.target.value)}
                      className="sm:col-span-2 bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-violet-500"
                    />

                    <select
                      value={newSkillImportance}
                      onChange={(e) => setNewSkillImportance(e.target.value)}
                      className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500"
                    >
                      <option value="Must Have">Must Have</option>
                      <option value="Good to Have">Good to Have</option>
                    </select>

                    <select
                      value={newSkillProficiency}
                      onChange={(e) => setNewSkillProficiency(e.target.value)}
                      className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500"
                    >
                      <option value="Beginner">Beginner</option>
                      <option value="Intermediate">Intermediate</option>
                      <option value="Advanced">Advanced</option>
                    </select>
                  </div>

                  <Button type="button" onClick={addRequiredSkill} className="w-full bg-violet-600 hover:bg-violet-500 text-xs h-9">
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add Required Skill
                  </Button>
                </div>

                {/* Skills List */}
                <div className="space-y-2">
                  {formData.requiredSkills.map((sk, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-zinc-900 border border-zinc-800 px-4 py-3 rounded-xl text-xs">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-white text-sm">{sk.name}</span>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                          sk.importance === "Must Have" ? "bg-rose-500/10 border border-rose-500/30 text-rose-400" : "bg-cyan-500/10 border border-cyan-500/30 text-cyan-400"
                        }`}>
                          {sk.importance}
                        </span>
                        <span className="bg-zinc-800 border border-zinc-700 text-zinc-300 px-2 py-0.5 rounded-md text-[10px]">
                          Proficiency: {sk.proficiency}
                        </span>
                      </div>
                      <button type="button" onClick={() => removeRequiredSkill(idx)} className="text-zinc-500 hover:text-rose-400 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 5: Required Experience */}
          {currentStep === 5 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Clock className="w-5 h-5 text-violet-400" /> 5. Required Experience
                </h3>
                <p className="text-xs text-zinc-400 mt-1">Specify total work experience range, relevant domain background, and fresher eligibility.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">
                    Minimum Experience (Years) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={formData.minExperience}
                    onChange={(e) => updateForm("minExperience", parseFloat(e.target.value) || 0)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">Maximum Experience (Years)</label>
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    placeholder="e.g. 5"
                    value={formData.maxExperience || ""}
                    onChange={(e) => updateForm("maxExperience", parseFloat(e.target.value) || null)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">Relevant Experience Required</label>
                  <input
                    type="text"
                    placeholder="e.g. 2+ years building REST/GraphQL APIs with Node.js and SQL databases"
                    value={formData.relevantExperience}
                    onChange={(e) => updateForm("relevantExperience", e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">Industry Experience</label>
                  <input
                    type="text"
                    placeholder="e.g. EdTech, FinTech, E-commerce, SaaS, Enterprise"
                    value={formData.industryExperience}
                    onChange={(e) => updateForm("industryExperience", e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500"
                  />
                </div>

                {/* Freshers Allowed Section */}
                <div className="md:col-span-2 bg-zinc-900/60 p-4 rounded-xl border border-zinc-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">Are Freshers Allowed?</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.freshersAllowed}
                        onChange={(e) => updateForm("freshersAllowed", e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600"></div>
                    </label>
                  </div>

                  {formData.freshersAllowed && (
                    <div className="pt-2 border-t border-zinc-800 space-y-2">
                      <span className="text-xs text-zinc-400 block">If freshers are allowed, what should they possess?</span>
                      <div className="flex flex-wrap gap-2">
                        {["Projects", "Internships", "Certifications", "Relevant Degree", "Other"].map((req) => {
                          const isSel = formData.fresherRequirements.includes(req);
                          return (
                            <button
                              key={req}
                              type="button"
                              onClick={() => toggleFresherRequirement(req)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                                isSel ? "bg-violet-600/20 border-violet-500 text-violet-300" : "bg-zinc-950 border-zinc-800 text-zinc-400"
                              }`}
                            >
                              {req} {isSel && "✓"}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 6: Education Requirements */}
          {currentStep === 6 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-violet-400" /> 6. Education Requirements
                </h3>
                <p className="text-xs text-zinc-400 mt-1">Specify minimum academic qualification, required degree fields, and professional certifications.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">Minimum Education</label>
                  <select
                    value={formData.minEducation}
                    onChange={(e) => updateForm("minEducation", e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500"
                  >
                    {["No Requirement", "Diploma", "Bachelor's", "Master's", "PhD"].map((ed) => (
                      <option key={ed} value={ed}>{ed}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">Required Degree / Field of Study</label>
                  <input
                    type="text"
                    placeholder="e.g. B.Tech / B.E. in CS / IT / Electrical or equivalent"
                    value={formData.requiredDegree}
                    onChange={(e) => updateForm("requiredDegree", e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">CGPA / Percentage Requirement (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. 60%+ or 6.5+ CGPA"
                    value={formData.cgpaRequirement}
                    onChange={(e) => updateForm("cgpaRequirement", e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">Certifications Required (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. AWS Certified Developer / PMP / Cisco CCNA"
                    value={formData.certificationsRequired}
                    onChange={(e) => updateForm("certificationsRequired", e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 7: Preferred Skills */}
          {currentStep === 7 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Star className="w-5 h-5 text-violet-400" /> 7. Preferred Skills (Nice-to-Have)
                </h3>
                <p className="text-xs text-zinc-400 mt-1">Enter skills and qualifications that are helpful bonus points but not strictly mandatory.</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-2">Preferred Tech Stack & Skills</label>

                  <div className="flex gap-2 mb-3">
                    <input
                      type="text"
                      placeholder="e.g. AWS, Kubernetes, Redis, GraphQL"
                      value={newPrefSkillInput}
                      onChange={(e) => setNewPrefSkillInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addPreferredSkill(); } }}
                      className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500"
                    />
                    <Button type="button" onClick={addPreferredSkill} className="bg-violet-600 hover:bg-violet-500 text-xs px-4">
                      <Plus className="w-4 h-4 mr-1" /> Add
                    </Button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {formData.preferredSkills.map((sk, idx) => (
                      <span key={idx} className="bg-zinc-900 border border-zinc-800 text-cyan-300 px-3 py-1 rounded-xl text-xs flex items-center gap-1.5">
                        ⭐ {sk}
                        <button type="button" onClick={() => removePreferredSkill(idx)} className="text-zinc-500 hover:text-rose-400">✕</button>
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">Preferred Previous Experience (Optional)</label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Prior work experience in high-growth startup environment or open-source contributions..."
                    value={formData.preferredExperience}
                    onChange={(e) => updateForm("preferredExperience", e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 text-sm text-white focus:outline-none focus:border-violet-500 leading-relaxed"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">Other Custom Requirements (Optional)</label>
                  <input
                    type="text"
                    placeholder="Any custom requirement specific to this role..."
                    value={formData.otherPreferredSkills}
                    onChange={(e) => updateForm("otherPreferredSkills", e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 8: Candidate Requirements */}
          {currentStep === 8 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-violet-400" /> 8. Candidate Requirements & Soft Skills
                </h3>
                <p className="text-xs text-zinc-400 mt-1">Explain in your own words what type of candidate you are looking for.</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">
                    Most Important Candidate Qualities <span className="text-rose-500">*</span>
                  </label>
                  <p className="text-[11px] text-zinc-500 mb-1">Describe desired soft skills, temperament, and behavioral mindset.</p>
                  <textarea
                    rows={4}
                    placeholder='e.g. "Strong problem-solving ability, good communication skills, patience when explaining technical concepts, and practical backend development experience."'
                    value={formData.candidateQualities}
                    onChange={(e) => updateForm("candidateQualities", e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 text-sm text-white focus:outline-none focus:border-violet-500 leading-relaxed"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-2">Languages Required</label>
                  <div className="flex gap-2 mb-3">
                    <input
                      type="text"
                      placeholder="e.g. English, Spanish, German"
                      value={newLangInput}
                      onChange={(e) => setNewLangInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLanguage(); } }}
                      className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500"
                    />
                    <Button type="button" onClick={addLanguage} className="bg-violet-600 hover:bg-violet-500 text-xs px-4">
                      <Plus className="w-4 h-4 mr-1" /> Add
                    </Button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {formData.languagesRequired.map((lang, idx) => (
                      <span key={idx} className="bg-zinc-900 border border-zinc-800 text-teal-300 px-3 py-1 rounded-xl text-xs flex items-center gap-1.5">
                        🌐 {lang}
                        <button type="button" onClick={() => removeLanguage(idx)} className="text-zinc-500 hover:text-rose-400">✕</button>
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">Other Role-Specific Requirements</label>
                  <textarea
                    rows={3}
                    placeholder="e.g. Willingness to relocate, Night-shift availability, Travel requirements, Work authorization..."
                    value={formData.otherRequirements}
                    onChange={(e) => updateForm("otherRequirements", e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 text-sm text-white focus:outline-none focus:border-violet-500 leading-relaxed"
                  />
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 9: Final Review & Submit */}
          {currentStep === 9 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" /> 9. Final Review & Publish
                </h3>
                <p className="text-xs text-zinc-400 mt-1">Review all 8 sections before publishing your Job Description.</p>
              </div>

              <div className="space-y-4">
                {/* Summary Card Preview */}
                <div className="bg-zinc-900/60 p-5 rounded-2xl border border-white/10 space-y-4 text-xs">
                  
                  {/* Basic Header */}
                  <div className="flex justify-between items-start border-b border-zinc-800 pb-3">
                    <div>
                      <h4 className="text-lg font-bold text-white">{formData.title || "Untitled Job"}</h4>
                      <p className="text-zinc-400 mt-0.5">
                        {formData.department} • {formData.jobLevel} • {formData.employmentType} ({formData.workMode})
                      </p>
                    </div>
                    <span className="bg-violet-500/10 border border-violet-500/20 text-violet-300 font-bold px-3 py-1 rounded-full text-[11px]">
                      {formData.openings} Opening(s)
                    </span>
                  </div>

                  {/* Summary */}
                  <div>
                    <span className="font-bold text-violet-400 uppercase text-[10px]">Short Summary</span>
                    <p className="text-zinc-300 mt-1 leading-relaxed">{formData.shortSummary}</p>
                  </div>

                  {/* Responsibilities */}
                  <div>
                    <span className="font-bold text-violet-400 uppercase text-[10px]">Primary Responsibilities ({formData.responsibilities.length})</span>
                    <ul className="list-disc list-inside text-zinc-300 mt-1 space-y-1">
                      {formData.responsibilities.map((r, i) => <li key={i}>{r}</li>)}
                    </ul>
                  </div>

                  {/* Required Skills */}
                  <div>
                    <span className="font-bold text-violet-400 uppercase text-[10px]">Required Technical Skills ({formData.requiredSkills.length})</span>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {formData.requiredSkills.map((sk, i) => (
                        <span key={i} className="bg-zinc-950 border border-zinc-800 px-2.5 py-1 rounded-md text-[11px]">
                          <strong className="text-white">{sk.name}</strong> ({sk.importance}, {sk.proficiency})
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Experience & Education */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-zinc-800 pt-3">
                    <div>
                      <span className="font-bold text-violet-400 uppercase text-[10px]">Experience Required</span>
                      <p className="text-zinc-300 mt-0.5">{formData.minExperience} - {formData.maxExperience || 'N/A'} years ({formData.freshersAllowed ? 'Freshers Allowed' : 'Experienced Only'})</p>
                    </div>
                    <div>
                      <span className="font-bold text-violet-400 uppercase text-[10px]">Education</span>
                      <p className="text-zinc-300 mt-0.5">{formData.minEducation} in {formData.requiredDegree || 'Relevant Field'}</p>
                    </div>
                  </div>

                  {/* Candidate Qualities */}
                  <div className="border-t border-zinc-800 pt-3">
                    <span className="font-bold text-violet-400 uppercase text-[10px]">Most Important Candidate Qualities</span>
                    <p className="text-zinc-300 mt-1 leading-relaxed italic">"{formData.candidateQualities}"</p>
                  </div>

                </div>

                {/* Final Actions */}
                <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-zinc-800">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleSave(true)}
                    disabled={isSavingDraft}
                    className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 text-xs h-11"
                  >
                    <Save className="w-4 h-4 mr-1.5" /> Save as Draft
                  </Button>

                  <Button
                    type="button"
                    onClick={() => handleSave(false)}
                    disabled={isSubmitting}
                    className="bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white font-bold text-sm h-11 px-8 shadow-[0_0_25px_rgba(139,92,246,0.3)]"
                  >
                    {isSubmitting ? "Publishing Job Opening..." : "Publish Job Opening & Finish"}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Navigation Controls Footer */}
          <div className="flex justify-between items-center pt-6 border-t border-zinc-800">
            <Button
              type="button"
              variant="outline"
              disabled={currentStep === 1}
              onClick={handleBack}
              className="border-zinc-800 text-zinc-400 hover:text-white text-xs h-10 px-4"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Previous Step
            </Button>

            {currentStep < STEPS.length && (
              <Button
                type="button"
                onClick={handleNext}
                className="bg-violet-600 hover:bg-violet-500 text-white text-xs h-10 px-6 font-semibold"
              >
                Next Step: {STEPS[currentStep].name} <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            )}
          </div>

        </Card>

      </div>
    </div>
  );
}
