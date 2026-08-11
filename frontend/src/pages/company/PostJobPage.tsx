import { useState, ChangeEvent, useEffect, useRef, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, ChevronRight, Bold, Italic, List, Link as LinkIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { setPageTitle } from '@/store/themeConfigSlice';
import companyService from '@/services/companyService';
import { JobPayload } from '@/types/companyPortal';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

const defaultForm: JobPayload = {
  title: '',
  employmentType: 'full-time',
  workplaceType: 'on-site',
  location: '',
  numberOfHiresNeeded: 1,
  maxApplications: undefined,
  applicationDeadline: '',
  status: 'published',

  description: '',
  requiredSkills: [],
  experienceLevel: 'mid',
  education: '',
  requiredEducation: '',

  interviewLanguage: 'English',
  interviewType: 'mixed',
  targetJobRole: '',
  durationMinutes: 30,
  focusSkills: [],
  numberOfQuestions: 5,
  resumeRequired: true,
  passingScoreThreshold: 70,
};

const PostJobPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');

  const [currentStep, setCurrentStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [loadingJob, setLoadingJob] = useState(false);
  const [publishedJobId, setPublishedJobId] = useState<string | null>(null);
  const [form, setForm] = useState<JobPayload>(defaultForm);
  const descRef = useRef<HTMLTextAreaElement>(null);

  const [reqSkillsInput, setReqSkillsInput] = useState('');
  const [focusSkillsInput, setFocusSkillsInput] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    dispatch(setPageTitle(editId ? 'Edit Job | RecruitAI' : 'Post a Job | RecruitAI'));
  }, [dispatch, editId]);

  useEffect(() => {
    const fetchJob = async () => {
      if (!editId) return;
      setLoadingJob(true);
      try {
        const j = await companyService.getJob(editId);
        if (j) {
          setForm({
            title: j.title || '',
            employmentType: j.employmentType || 'full-time',
            workplaceType: j.workplaceType || 'on-site',
            location: j.location || '',
            numberOfHiresNeeded: j.numberOfHiresNeeded || 1,
            maxApplications: j.maxApplications,
            applicationDeadline: j.applicationDeadline ? j.applicationDeadline.slice(0, 10) : '',
            status: j.status || 'published',
            description: j.description || '',
            requiredSkills: j.requiredSkills || [],
            experienceLevel: j.experienceLevel || 'mid',
            education: j.education || '',
            requiredEducation: j.requiredEducation || j.education || '',
            interviewLanguage: j.interviewLanguage || 'English',
            interviewType: j.interviewType || 'mixed',
            targetJobRole: j.targetJobRole || '',
            durationMinutes: j.durationMinutes || 30,
            focusSkills: j.focusSkills || [],
            numberOfQuestions: j.numberOfQuestions || 5,
            resumeRequired: j.resumeRequired !== false,
            passingScoreThreshold: j.passingScoreThreshold ?? 70,
          });
        }
      } catch (err: any) {
        toast.error('Failed to load existing job details');
      } finally {
        setLoadingJob(false);
      }
    };
    void fetchJob();
  }, [editId]);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const target = e.target;
    const value = target.type === 'checkbox' ? (target as HTMLInputElement).checked : target.value;
    setForm((prev) => ({ ...prev, [target.name]: value }));
    setFieldErrors((prev) => { const n = { ...prev }; delete n[target.name]; return n; });
  };

  const validateStep = (step: number): boolean => {
    const errors: Record<string, string> = {};
    if (step === 1) {
      const t = form.title.trim();
      if (!t || t.length < 3 || t.length > 150) errors.title = 'Job title must be 3–150 characters';
      if (!form.location.trim() || form.location.trim().length < 2) errors.location = 'Please enter a valid location';
      if (!form.description.trim() || form.description.trim().length < 20) errors.description = 'Description must be at least 20 characters';
    }
    if (step === 2) {
      if (!form.numberOfHiresNeeded || Number(form.numberOfHiresNeeded) < 1)
        errors.numberOfHiresNeeded = 'Must be at least 1';
      const max = form.maxApplications;
      if (max !== undefined && String(max) !== '' && Number(max) < 1)
        errors.maxApplications = 'Must be at least 1, or leave blank for no limit';
    }
    if (step === 3) {
      if (form.durationMinutes < 5 || form.durationMinutes > 120) errors.durationMinutes = 'Must be between 5 and 120 minutes';
      if (form.numberOfQuestions < 1 || form.numberOfQuestions > 20) errors.numberOfQuestions = 'Must be between 1 and 20';
      if (form.passingScoreThreshold < 0 || form.passingScoreThreshold > 100) errors.passingScoreThreshold = 'Must be between 0 and 100';
    }
    setFieldErrors(errors);
    const firstKey = Object.keys(errors)[0];
    if (firstKey) { document.getElementById(firstKey)?.focus(); return false; }
    return true;
  };

  const addRequiredSkill = () => {
    if (!reqSkillsInput.trim()) return;
    setForm((prev) => ({ ...prev, requiredSkills: [...prev.requiredSkills, reqSkillsInput.trim()] }));
    setReqSkillsInput('');
  };

  const removeRequiredSkill = (idx: number) => {
    setForm((prev) => ({ ...prev, requiredSkills: prev.requiredSkills.filter((_, i) => i !== idx) }));
  };



  const addFocusSkill = () => {
    if (!focusSkillsInput.trim()) return;
    setForm((prev) => ({ ...prev, focusSkills: [...(prev.focusSkills || []), focusSkillsInput.trim()] }));
    setFocusSkillsInput('');
  };

  const insertMarkdown = useCallback((type: 'bold' | 'italic' | 'list') => {
    const textarea = descRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selected = text.substring(start, end);

    let before = '';
    let after = '';
    let placeholder = '';
    if (type === 'bold') {
      before = '**'; after = '**'; placeholder = 'bold text';
    } else if (type === 'italic') {
      before = '*'; after = '*'; placeholder = 'italic text';
    } else if (type === 'list') {
      // Insert at start of line
      const lineStart = text.lastIndexOf('\n', start - 1) + 1;
      const linePrefix = text.substring(lineStart, start);
      before = linePrefix.startsWith('- ') ? '' : '\n- ';
      after = '';
      placeholder = selected || 'list item';
    }

    const insertText = type === 'list'
      ? `${before}${selected || placeholder}`
      : `${before}${selected || placeholder}${after}`;

    const newValue = text.substring(0, start) + insertText + text.substring(end);
    setForm((prev) => ({ ...prev, description: newValue }));

    requestAnimationFrame(() => {
      textarea.focus();
      if (selected) {
        textarea.setSelectionRange(start + before.length, start + before.length + selected.length);
      } else {
        const contentStart = start + before.length;
        const contentEnd = contentStart + placeholder.length;
        textarea.setSelectionRange(contentStart, contentEnd);
      }
    });
  }, []);

  const handleDescKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'b') { e.preventDefault(); insertMarkdown('bold'); }
      else if (e.key === 'i') { e.preventDefault(); insertMarkdown('italic'); }
      else if (e.key === 'l') { e.preventDefault(); insertMarkdown('list'); }
    }
    // Auto-continue bullet list on Enter
    if (e.key === 'Enter') {
      const textarea = descRef.current;
      if (!textarea) return;
      const pos = textarea.selectionStart;
      const text = textarea.value;
      const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
      const currentLine = text.substring(lineStart, pos);
      if (currentLine.startsWith('- ') && currentLine.length > 2) {
        e.preventDefault();
        const newValue = text.substring(0, pos) + '\n- ' + text.substring(textarea.selectionEnd);
        setForm((prev) => ({ ...prev, description: newValue }));
        requestAnimationFrame(() => {
          textarea.setSelectionRange(pos + 3, pos + 3);
        });
      }
    }
  }, [insertMarkdown]);

  const removeFocusSkill = (idx: number) => {
    setForm((prev) => ({ ...prev, focusSkills: (prev.focusSkills || []).filter((_, i) => i !== idx) }));
  };

  const handleSubmit = async (publishStatus: 'draft' | 'published') => {
    const trimmedTitle = form.title.trim();
    const trimmedLocation = form.location.trim();
    const trimmedDesc = form.description.trim();

    if (!trimmedTitle || !trimmedLocation || !trimmedDesc) {
      toast.error('Please fill in all required fields (Job Title, Location, and Description)');
      return;
    }

    if (trimmedTitle.length < 3 || trimmedTitle.length > 150) {
      toast.error('Job Title must be between 3 and 150 characters');
      return;
    }

    if (trimmedLocation.length < 2) {
      toast.error('Please specify a valid Location (e.g. Mogadishu, Remote, Hybrid)');
      return;
    }

    if (trimmedDesc.length < 20) {
      toast.error('Job Description must be at least 20 characters to provide sufficient context for AI interview generation');
      return;
    }

    if (form.numberOfHiresNeeded < 1) {
      toast.error('Number of hires needed must be at least 1');
      return;
    }

    if (form.maxApplications !== undefined && form.maxApplications < 1) {
      toast.error('Maximum candidate applications must be at least 1 or left blank');
      return;
    }

    if (form.durationMinutes < 5 || form.durationMinutes > 120) {
      toast.error('Interview duration must be between 5 and 120 minutes');
      return;
    }

    if (form.numberOfQuestions < 1 || form.numberOfQuestions > 20) {
      toast.error('Number of questions must be between 1 and 20');
      return;
    }

    if (form.passingScoreThreshold < 0 || form.passingScoreThreshold > 100) {
      toast.error('Passing score threshold must be between 0% and 100%');
      return;
    }

    if (form.applicationDeadline) {
      const selectedDeadline = new Date(form.applicationDeadline).getTime();
      const today = new Date().setHours(0, 0, 0, 0);
      if (selectedDeadline < today) {
        toast.error('Application deadline cannot be a date in the past');
        return;
      }
    }

    setSaving(true);

    try {
      if (editId) {
        await companyService.updateJob(editId, { ...form, status: publishStatus });
        toast.success(publishStatus === 'published' ? 'Job updated successfully!' : 'Job draft saved!');
        navigate('/company/jobs');
      } else {
        const job = await companyService.createJob({ ...form, status: publishStatus });
        if (publishStatus === 'published') {
          setPublishedJobId(job._id);
        } else {
          toast.success('Job draft saved!');
          navigate('/company/jobs');
        }
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || (editId ? 'Failed to update job' : 'Failed to create job'));
    } finally {
      setSaving(false);
    }
  };

  const steps = [
    { number: 1, title: 'Job Details' },
    { number: 2, title: 'Hiring Plan' },
    { number: 3, title: 'Interview Setup' },
  ];

  if (loadingJob) {
    return (
      <div className="flex h-96 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (publishedJobId) {
    const publicUrl = `${window.location.origin}/jobs/${publishedJobId}`;
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-6 max-w-xl mx-auto text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-success/10 text-success">
          <CheckCircle2 className="h-10 w-10" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-black dark:text-white">Job Published!</h2>
          <p className="mt-2 text-sm text-white-dark">
            Share this link with candidates so they can view the job and apply.
          </p>
        </div>
        <div className="w-full rounded-lg border border-white-light dark:border-white-light/10 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <LinkIcon className="h-4 w-4 text-primary shrink-0" />
            <p className="text-xs font-bold text-white-dark uppercase">Application Link</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={publicUrl}
              className="form-input flex-1 text-sm font-mono bg-gray-50 dark:bg-dark"
            />
            <button
              type="button"
              className="btn btn-primary shrink-0"
              onClick={() => {
                void navigator.clipboard.writeText(publicUrl);
                toast.success('Link copied!');
              }}
            >
              Copy
            </button>
          </div>
        </div>
        <div className="flex gap-3">
          <button type="button" className="btn btn-outline-secondary" onClick={() => navigate('/company/jobs')}>
            View All Jobs
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setPublishedJobId(null);
              setForm(defaultForm);
              setCurrentStep(1);
            }}
          >
            Post Another Job
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <div className="text-xs font-semibold text-white-dark flex items-center gap-2">
        <span>Jobs</span>
        <ChevronRight className="h-3 w-3" />
        <span className="text-black dark:text-white">{editId ? 'Edit Job' : 'Post a Job'}</span>
      </div>

      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold text-black dark:text-white">{editId ? 'Edit Job' : 'Post a Job'}</h1>
        <p className="mt-1 text-sm text-white-dark">
          {editId ? 'Modify requisition details and interview parameters.' : 'Create a job in a few simple steps.'}
        </p>
      </div>

      {/* Step Wizard Header */}
          <div className="panel py-4">
            <div className="flex items-center justify-between px-2">
              {steps.map((step, idx) => (
                <div key={step.number} className="flex items-center flex-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (step.number < currentStep) { setCurrentStep(step.number); return; }
                      if (step.number === currentStep) return;
                      if (validateStep(currentStep)) setCurrentStep(step.number);
                    }}
                    className={`flex items-center gap-2 font-semibold text-sm ${
                      currentStep === step.number
                        ? 'text-primary font-bold'
                        : currentStep > step.number
                        ? 'text-success'
                        : 'text-white-dark'
                    }`}
                  >
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                        currentStep === step.number
                          ? 'bg-primary text-white'
                          : currentStep > step.number
                          ? 'bg-success text-white'
                          : 'bg-gray-200 dark:bg-dark text-white-dark'
                      }`}
                    >
                      {currentStep > step.number ? <CheckCircle2 className="h-4 w-4" /> : step.number}
                    </span>
                    <span className="hidden sm:inline">{step.title}</span>
                  </button>
                  {idx < steps.length - 1 && (
                    <div
                      className={`h-0.5 flex-1 mx-2 sm:mx-4 ${
                        currentStep > step.number ? 'bg-success' : 'bg-gray-200 dark:bg-dark'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
          {/* STEP 1: JOB DETAILS */}
          {currentStep === 1 && (
            <div className="panel space-y-5">
              <div>
                <h2 className="text-lg font-bold text-black dark:text-white">Section 1: Basic Job Information</h2>
                <p className="text-xs text-white-dark">Provide basic information about the role you are hiring for.</p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="title">Job title *</label>
                  <input
                    id="title"
                    name="title"
                    className={`form-input${fieldErrors.title ? ' !border-danger' : ''}`}
                    placeholder="Enter job title (e.g. Senior Frontend Developer)"
                    value={form.title}
                    onChange={handleChange}
                    required
                  />
                  {fieldErrors.title && <p className="mt-1 text-xs text-danger">{fieldErrors.title}</p>}
                </div>


                <div>
                  <label htmlFor="employmentType">Employment type *</label>
                  <select
                    id="employmentType"
                    name="employmentType"
                    className="form-select"
                    value={form.employmentType}
                    onChange={handleChange}
                  >
                    <option value="full-time">Full-time</option>
                    <option value="part-time">Part-time</option>
                    <option value="contract">Contract</option>
                    <option value="internship">Internship</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="workplaceType">Workplace type *</label>
                  <select
                    id="workplaceType"
                    name="workplaceType"
                    className="form-select"
                    value={form.workplaceType}
                    onChange={handleChange}
                  >
                    <option value="on-site">On-site</option>
                    <option value="remote">Remote</option>
                    <option value="hybrid">Hybrid</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="location">Location *</label>
                  <input
                    id="location"
                    name="location"
                    className={`form-input${fieldErrors.location ? ' !border-danger' : ''}`}
                    placeholder="e.g. Mogadishu, Somalia / Remote"
                    value={form.location}
                    onChange={handleChange}
                    required
                  />
                  {fieldErrors.location && <p className="mt-1 text-xs text-danger">{fieldErrors.location}</p>}
                </div>

                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="mb-0">Job description *</label>
                    <div className="flex items-center gap-1 text-xs text-white-dark">
                      <kbd className="px-1 py-0.5 rounded border border-white-light dark:border-white-light/20 bg-slate-100 dark:bg-slate-800 font-mono text-[10px]">Ctrl+B</kbd>
                      <span>bold</span>
                      <kbd className="px-1 py-0.5 rounded border border-white-light dark:border-white-light/20 bg-slate-100 dark:bg-slate-800 font-mono text-[10px]">Ctrl+I</kbd>
                      <span>italic</span>
                      <kbd className="px-1 py-0.5 rounded border border-white-light dark:border-white-light/20 bg-slate-100 dark:bg-slate-800 font-mono text-[10px]">Ctrl+L</kbd>
                      <span>list</span>
                    </div>
                  </div>

                  {/* Formatting Toolbar */}
                  <div className="flex items-center gap-1 px-2 py-1 border border-b-0 border-white-light dark:border-white-light/10 bg-slate-50 dark:bg-slate-800/60 rounded-t-lg">
                    <button
                      type="button"
                      className="p-1.5 rounded hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
                      onClick={() => insertMarkdown('bold')}
                      title="Bold (Ctrl+B)"
                    >
                      <Bold className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      className="p-1.5 rounded hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
                      onClick={() => insertMarkdown('italic')}
                      title="Italic (Ctrl+I)"
                    >
                      <Italic className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      className="p-1.5 rounded hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
                      onClick={() => insertMarkdown('list')}
                      title="Bullet List (Ctrl+L)"
                    >
                      <List className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <textarea
                    ref={descRef}
                    id="description"
                    name="description"
                    rows={8}
                    className={`form-textarea rounded-t-none border-t-0 font-mono text-sm${fieldErrors.description ? ' !border-danger' : ''}`}
                    placeholder={`Write the job description here...\n\nTip: Use **text** for bold, *text* for italic, start a line with - for bullets.`}
                    value={form.description}
                    onChange={handleChange}
                    onKeyDown={handleDescKeyDown}
                    required
                  />
                  {fieldErrors.description && <p className="mt-1 text-xs text-danger">{fieldErrors.description}</p>}
                </div>
              </div>

              <div>
                <h2 className="text-lg font-bold text-black dark:text-white pt-4 border-t border-white-light dark:border-white-light/10">
                  Section 2: Job Details & Requirements
                </h2>
                <p className="text-xs text-white-dark mb-4">Describe the role, key responsibilities, required skills, and qualifications.</p>
              </div>


              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="experienceLevel">Minimum Experience *</label>
                  <select
                    id="experienceLevel"
                    name="experienceLevel"
                    className="form-select"
                    value={form.experienceLevel}
                    onChange={handleChange}
                  >
                    <option value="junior">Junior (0-2 years)</option>
                    <option value="mid">Mid-level (2-5 years)</option>
                    <option value="senior">Senior (5+ years)</option>
                    <option value="lead">Lead / Principal</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="requiredEducation">Required Education / Qualifications</label>
                  <textarea
                    id="requiredEducation"
                    name="requiredEducation"
                    rows={3}
                    className="form-textarea"
                    placeholder="e.g. Bachelor's degree in Computer Science, Software Engineering, or related field."
                    value={form.requiredEducation || form.education || ''}
                    onChange={(e) => {
                      handleChange(e);
                      setForm((prev) => ({ ...prev, education: e.target.value }));
                    }}
                  />
                </div>
              </div>

              {/* Skills Tags */}
              <div>
                <label>Required Skills</label>
                <div className="flex gap-2">
                  <input
                    className="form-input flex-1"
                    placeholder="Add a required skill"
                    value={reqSkillsInput}
                    onChange={(e) => setReqSkillsInput(e.target.value)}
                  />
                  <button type="button" className="btn btn-outline-primary" onClick={addRequiredSkill}>
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {form.requiredSkills.map((sk, i) => (
                    <span key={i} className="badge badge-outline-primary flex items-center gap-1">
                      {sk}
                      <button type="button" onClick={() => removeRequiredSkill(i)}>
                        &times;
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: HIRING PLAN */}
          {currentStep === 2 && (
            <div className="panel space-y-5">
              <h2 className="text-lg font-bold text-black dark:text-white">Hiring Plan & Capacity</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="numberOfHiresNeeded">Number of Hires Needed</label>
                  <input
                    id="numberOfHiresNeeded"
                    name="numberOfHiresNeeded"
                    type="number"
                    min={1}
                    className={`form-input${fieldErrors.numberOfHiresNeeded ? ' !border-danger' : ''}`}
                    value={form.numberOfHiresNeeded}
                    onChange={handleChange}
                  />
                  {fieldErrors.numberOfHiresNeeded && <p className="mt-1 text-xs text-danger">{fieldErrors.numberOfHiresNeeded}</p>}
                </div>

                <div>
                  <label htmlFor="maxApplications">Maximum Candidate Applications (Optional)</label>
                  <input
                    id="maxApplications"
                    name="maxApplications"
                    type="number"
                    min={1}
                    className={`form-input${fieldErrors.maxApplications ? ' !border-danger' : ''}`}
                    placeholder="No limit"
                    value={form.maxApplications || ''}
                    onChange={handleChange}
                  />
                  {fieldErrors.maxApplications && <p className="mt-1 text-xs text-danger">{fieldErrors.maxApplications}</p>}
                </div>

                <div>
                  <label htmlFor="applicationDeadline">Application Deadline</label>
                  <input
                    id="applicationDeadline"
                    name="applicationDeadline"
                    type="date"
                    className="form-input"
                    value={form.applicationDeadline ? form.applicationDeadline.slice(0, 10) : ''}
                    onChange={handleChange}
                  />
                </div>

                <div>
                  <label htmlFor="status">Job Status</label>
                  <select id="status" name="status" className="form-select" value={form.status} onChange={handleChange}>
                    <option value="published">Published</option>
                    <option value="draft">Draft</option>
                    <option value="paused">Paused</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: INTERVIEW CONFIGURATION */}
          {currentStep === 3 && (
            <div className="panel space-y-5">
              <h2 className="text-lg font-bold text-black dark:text-white">Section 3: Interview Configuration</h2>
              <p className="text-xs text-white-dark">Configure the automated AI Mock Interview parameters for applicants.</p>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* 1. Interview Language * */}
                <div>
                  <label htmlFor="interviewLanguage">Interview Language *</label>
                  <select
                    id="interviewLanguage"
                    name="interviewLanguage"
                    className="form-select"
                    value={form.interviewLanguage}
                    onChange={handleChange}
                  >
                    <option value="English">English</option>
                    <option value="Somali">Somali</option>
                  </select>
                </div>



                {/* 6. Interview Duration (minutes) */}
                <div>
                  <label htmlFor="durationMinutes">Interview Duration (minutes)</label>
                  <input
                    id="durationMinutes"
                    name="durationMinutes"
                    type="number"
                    min={5}
                    max={120}
                    className={`form-input${fieldErrors.durationMinutes ? ' !border-danger' : ''}`}
                    value={form.durationMinutes}
                    onChange={handleChange}
                  />
                  {fieldErrors.durationMinutes && <p className="mt-1 text-xs text-danger">{fieldErrors.durationMinutes}</p>}
                </div>

                {/* 7. Number of Questions */}
                <div>
                  <label htmlFor="numberOfQuestions">Number of Questions</label>
                  <input
                    id="numberOfQuestions"
                    name="numberOfQuestions"
                    type="number"
                    min={1}
                    max={20}
                    className={`form-input${fieldErrors.numberOfQuestions ? ' !border-danger' : ''}`}
                    value={form.numberOfQuestions}
                    onChange={handleChange}
                  />
                  {fieldErrors.numberOfQuestions && <p className="mt-1 text-xs text-danger">{fieldErrors.numberOfQuestions}</p>}
                </div>

                {/* 8. Passing Score Threshold (%) */}
                <div>
                  <label htmlFor="passingScoreThreshold">Passing Score Threshold (%)</label>
                  <input
                    id="passingScoreThreshold"
                    name="passingScoreThreshold"
                    type="number"
                    min={0}
                    max={100}
                    className={`form-input${fieldErrors.passingScoreThreshold ? ' !border-danger' : ''}`}
                    value={form.passingScoreThreshold}
                    onChange={handleChange}
                  />
                  {fieldErrors.passingScoreThreshold && <p className="mt-1 text-xs text-danger">{fieldErrors.passingScoreThreshold}</p>}
                </div>
              </div>

              {/* 10. Candidate Requirements */}
              <div className="pt-4 border-t border-white-light dark:border-white-light/10 space-y-3">
                <h3 className="text-sm font-bold text-black dark:text-white">Candidate Requirements</h3>
                <div>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      name="resumeRequired"
                      className="form-checkbox"
                      checked={form.resumeRequired}
                      onChange={handleChange}
                    />
                    <span className="text-sm font-semibold">Require Resume Upload</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4">
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={() => {
                if (currentStep > 1) setCurrentStep(currentStep - 1);
                else navigate('/company/jobs');
              }}
            >
              {currentStep > 1 ? 'Back' : 'Cancel'}
            </button>

            <div className="flex gap-3">
              <button
                type="button"
                className="btn btn-outline-secondary"
                disabled={saving}
                onClick={() => void handleSubmit('draft')}
              >
                Save Draft
              </button>

              {currentStep < 3 ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => { if (validateStep(currentStep)) setCurrentStep(currentStep + 1); }}
                >
                  Continue
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={saving}
                  onClick={() => void handleSubmit('published')}
                >
                  {editId ? (saving ? 'Updating...' : 'Update Job') : (saving ? 'Publishing...' : 'Publish Job')}
                </button>
              )}
            </div>
          </div>
    </div>
  );
};

export default PostJobPage;
