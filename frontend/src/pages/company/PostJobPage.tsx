import { useState, ChangeEvent, FormEvent, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Users, Calendar, Info, CheckCircle2, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { setPageTitle } from '@/store/themeConfigSlice';
import companyService from '@/services/companyService';
import { JobPayload } from '@/types/companyPortal';

const defaultForm: JobPayload = {
  title: '',
  department: '',
  employmentType: 'full-time',
  workplaceType: 'on-site',
  location: '',
  numberOfHiresNeeded: 1,
  maxApplications: undefined,
  applicationDeadline: '',
  status: 'published',

  description: '',
  responsibilities: '',
  requiredSkills: [],
  preferredSkills: [],
  experienceLevel: 'mid',
  education: '',
  requiredEducation: '',
  salaryRange: '',
  benefitsNotes: '',

  interviewLanguage: 'English',
  interviewType: 'mixed',
  difficulty: 'mid',
  targetJobRole: '',
  durationMinutes: 30,
  focusSkills: [],
  numberOfQuestions: 5,
  resumeRequired: true,
  coverLetterRequired: false,
  allowCandidateSelectTime: true,
  completionDeadline: '',
  interviewExpiryDate: '',
  passingScoreThreshold: 70,
};

const PostJobPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<JobPayload>(defaultForm);

  const [reqSkillsInput, setReqSkillsInput] = useState('');
  const [prefSkillsInput, setPrefSkillsInput] = useState('');
  const [focusSkillsInput, setFocusSkillsInput] = useState('');

  useEffect(() => {
    dispatch(setPageTitle('Post a Job | RecruitAI'));
  }, [dispatch]);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const target = e.target;
    const value = target.type === 'checkbox' ? (target as HTMLInputElement).checked : target.value;
    setForm((prev) => ({ ...prev, [target.name]: value }));
  };

  const addRequiredSkill = () => {
    if (!reqSkillsInput.trim()) return;
    setForm((prev) => ({ ...prev, requiredSkills: [...prev.requiredSkills, reqSkillsInput.trim()] }));
    setReqSkillsInput('');
  };

  const removeRequiredSkill = (idx: number) => {
    setForm((prev) => ({ ...prev, requiredSkills: prev.requiredSkills.filter((_, i) => i !== idx) }));
  };

  const addPreferredSkill = () => {
    if (!prefSkillsInput.trim()) return;
    setForm((prev) => ({ ...prev, preferredSkills: [...prev.preferredSkills, prefSkillsInput.trim()] }));
    setPrefSkillsInput('');
  };

  const removePreferredSkill = (idx: number) => {
    setForm((prev) => ({ ...prev, preferredSkills: prev.preferredSkills.filter((_, i) => i !== idx) }));
  };

  const addFocusSkill = () => {
    if (!focusSkillsInput.trim()) return;
    setForm((prev) => ({ ...prev, focusSkills: [...(prev.focusSkills || []), focusSkillsInput.trim()] }));
    setFocusSkillsInput('');
  };

  const removeFocusSkill = (idx: number) => {
    setForm((prev) => ({ ...prev, focusSkills: (prev.focusSkills || []).filter((_, i) => i !== idx) }));
  };

  const handleSubmit = async (publishStatus: 'draft' | 'published') => {
    if (!form.title || !form.department || !form.location || !form.description) {
      toast.error('Please fill in all required fields (Title, Department, Location, Description)');
      return;
    }

    setSaving(true);
    try {
      await companyService.createJob({ ...form, status: publishStatus });
      toast.success(publishStatus === 'published' ? 'Job published successfully!' : 'Job draft saved!');
      navigate('/company/jobs');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create job');
    } finally {
      setSaving(false);
    }
  };

  const steps = [
    { number: 1, title: 'Job Details' },
    { number: 2, title: 'Hiring Plan' },
    { number: 3, title: 'Interview Setup' },
    { number: 4, title: 'Review & Publish' },
  ];

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="text-xs font-semibold text-white-dark flex items-center gap-2">
        <span>Jobs</span>
        <ChevronRight className="h-3 w-3" />
        <span className="text-black dark:text-white">Post a Job</span>
      </div>

      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold text-black dark:text-white">Post a Job</h1>
        <p className="mt-1 text-sm text-white-dark">Create a job in a few simple steps.</p>
      </div>

      {/* Main Grid: Form Left, Sidebar Right */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Form Area */}
        <div className="lg:col-span-2 space-y-6">
          {/* Step Wizard Header */}
          <div className="panel py-4">
            <div className="flex items-center justify-between px-2">
              {steps.map((step, idx) => (
                <div key={step.number} className="flex items-center flex-1">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(step.number)}
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
          {(currentStep === 1 || currentStep === 4) && (
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
                    className="form-input"
                    placeholder="Enter job title (e.g. Senior Frontend Developer)"
                    value={form.title}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="department">Department / Team *</label>
                  <input
                    id="department"
                    name="department"
                    className="form-input"
                    placeholder="e.g. Engineering, Product, Marketing"
                    value={form.department}
                    onChange={handleChange}
                    required
                  />
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
                    className="form-input"
                    placeholder="e.g. Mogadishu, Somalia / Remote"
                    value={form.location}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="description">Job description *</label>
                  <textarea
                    id="description"
                    name="description"
                    rows={5}
                    className="form-textarea"
                    placeholder="Describe the role, responsibilities, and overall expectations..."
                    value={form.description}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div>
                <h2 className="text-lg font-bold text-black dark:text-white pt-4 border-t border-white-light dark:border-white-light/10">
                  Section 2: Job Details & Requirements
                </h2>
                <p className="text-xs text-white-dark mb-4">Describe the role, key responsibilities, required skills, and qualifications.</p>
              </div>

              <div>
                <label htmlFor="responsibilities">Main Responsibilities</label>
                <textarea
                  id="responsibilities"
                  name="responsibilities"
                  rows={3}
                  className="form-textarea"
                  placeholder="List key daily responsibilities..."
                  value={form.responsibilities}
                  onChange={handleChange}
                />
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
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

                <div>
                  <label>Preferred Skills</label>
                  <div className="flex gap-2">
                    <input
                      className="form-input flex-1"
                      placeholder="Add a preferred skill"
                      value={prefSkillsInput}
                      onChange={(e) => setPrefSkillsInput(e.target.value)}
                    />
                    <button type="button" className="btn btn-outline-secondary" onClick={addPreferredSkill}>
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {form.preferredSkills.map((sk, i) => (
                      <span key={i} className="badge badge-outline-secondary flex items-center gap-1">
                        {sk}
                        <button type="button" onClick={() => removePreferredSkill(i)}>
                          &times;
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="salaryRange">Salary Range (Optional)</label>
                  <input
                    id="salaryRange"
                    name="salaryRange"
                    className="form-input"
                    placeholder="e.g. $2,000 - $3,500 / month"
                    value={form.salaryRange}
                    onChange={handleChange}
                  />
                </div>

                <div>
                  <label htmlFor="benefitsNotes">Benefits / Compensation Notes (Optional)</label>
                  <input
                    id="benefitsNotes"
                    name="benefitsNotes"
                    className="form-input"
                    placeholder="Health insurance, remote stipend, performance bonus"
                    value={form.benefitsNotes}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: HIRING PLAN */}
          {(currentStep === 2 || currentStep === 4) && (
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
                    className="form-input"
                    value={form.numberOfHiresNeeded}
                    onChange={handleChange}
                  />
                </div>

                <div>
                  <label htmlFor="maxApplications">Maximum Candidate Applications (Optional)</label>
                  <input
                    id="maxApplications"
                    name="maxApplications"
                    type="number"
                    min={1}
                    className="form-input"
                    placeholder="No limit"
                    value={form.maxApplications || ''}
                    onChange={handleChange}
                  />
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
          {(currentStep === 3 || currentStep === 4) && (
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

                {/* 2. Interview Type * */}
                <div>
                  <label htmlFor="interviewType">Interview Type *</label>
                  <select
                    id="interviewType"
                    name="interviewType"
                    className="form-select"
                    value={form.interviewType}
                    onChange={handleChange}
                  >
                    <option value="mixed">Mixed (Technical + HR)</option>
                    <option value="technical">Technical</option>
                    <option value="behavioral">Behavioral</option>
                    <option value="hr">HR / Culture Fit</option>
                    <option value="system-design">System Design</option>
                  </select>
                </div>

                {/* 3. Target Job Role * */}
                <div>
                  <label htmlFor="targetJobRole">Target Job Role *</label>
                  <input
                    id="targetJobRole"
                    name="targetJobRole"
                    className="form-input"
                    placeholder="Machine Learning Engineer Intern"
                    value={form.targetJobRole}
                    onChange={handleChange}
                    required
                  />
                </div>

                {/* 4. Interview Difficulty * */}
                <div>
                  <label htmlFor="difficulty">Interview Difficulty *</label>
                  <select
                    id="difficulty"
                    name="difficulty"
                    className="form-select"
                    value={form.difficulty}
                    onChange={handleChange}
                  >
                    <option value="junior">Junior</option>
                    <option value="mid">Mid-level</option>
                    <option value="senior">Senior</option>
                    <option value="lead">Lead</option>
                  </select>
                </div>

                {/* 5. Focus Skills / Assessment Criteria * */}
                <div className="sm:col-span-2">
                  <label>Focus Skills / Assessment Criteria *</label>
                  <div className="flex gap-2">
                    <input
                      className="form-input flex-1"
                      placeholder="e.g. Python Programming, Machine Learning Fundamentals, Problem Solving"
                      value={focusSkillsInput}
                      onChange={(e) => setFocusSkillsInput(e.target.value)}
                    />
                    <button type="button" className="btn btn-outline-primary" onClick={addFocusSkill}>
                      Add Skill
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {(form.focusSkills || []).map((sk, i) => (
                      <span key={i} className="badge badge-outline-primary flex items-center gap-1">
                        {sk}
                        <button type="button" onClick={() => removeFocusSkill(i)}>
                          &times;
                        </button>
                      </span>
                    ))}
                  </div>
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
                    className="form-input"
                    value={form.durationMinutes}
                    onChange={handleChange}
                  />
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
                    className="form-input"
                    value={form.numberOfQuestions}
                    onChange={handleChange}
                  />
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
                    className="form-input"
                    value={form.passingScoreThreshold}
                    onChange={handleChange}
                  />
                </div>

                {/* 9. Interview Expiry / Completion Deadline */}
                <div>
                  <label htmlFor="interviewExpiryDate">Interview Expiry / Completion Deadline</label>
                  <input
                    id="interviewExpiryDate"
                    name="interviewExpiryDate"
                    type="date"
                    className="form-input"
                    value={
                      form.interviewExpiryDate
                        ? form.interviewExpiryDate.slice(0, 10)
                        : form.completionDeadline
                        ? form.completionDeadline.slice(0, 10)
                        : ''
                    }
                    onChange={(e) => {
                      handleChange(e);
                      setForm((prev) => ({ ...prev, completionDeadline: e.target.value }));
                    }}
                  />
                </div>
              </div>

              {/* 10. Candidate Requirements */}
              <div className="pt-4 border-t border-white-light dark:border-white-light/10 space-y-3">
                <h3 className="text-sm font-bold text-black dark:text-white">Candidate Requirements</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      name="coverLetterRequired"
                      className="form-checkbox"
                      checked={form.coverLetterRequired}
                      onChange={handleChange}
                    />
                    <span className="text-sm font-semibold">Require Cover Letter</span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer sm:col-span-2">
                    <input
                      type="checkbox"
                      name="allowCandidateSelectTime"
                      className="form-checkbox"
                      checked={form.allowCandidateSelectTime}
                      onChange={handleChange}
                    />
                    <span className="text-sm font-semibold">Allow Candidate to Select Interview Time</span>
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

              {currentStep < 4 ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setCurrentStep(currentStep + 1)}
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
                  {saving ? 'Publishing...' : 'Publish Job'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Info Card (Matches Provided Screenshot) */}
        <div className="space-y-6">
          <div className="panel space-y-6">
            <h3 className="text-base font-bold text-black dark:text-white border-b border-white-light dark:border-white-light/10 pb-3">
              What you'll configure next
            </h3>

            {/* Hiring Plan Section Info */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-bold text-black dark:text-white">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Users className="h-4 w-4" />
                </span>
                <span>Hiring Plan</span>
              </div>
              <ul className="text-xs text-white-dark space-y-1.5 pl-9 list-disc">
                <li>Number of hires</li>
                <li>Application limit</li>
                <li>Application deadline</li>
              </ul>
            </div>

            {/* Interview Setup Section Info */}
            <div className="space-y-2 pt-3 border-t border-white-light dark:border-white-light/10">
              <div className="flex items-center gap-2 text-sm font-bold text-black dark:text-white">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Calendar className="h-4 w-4" />
                </span>
                <span>Interview Setup</span>
              </div>
              <ul className="text-xs text-white-dark space-y-1.5 pl-9 list-disc">
                <li>Interview Language ({form.interviewLanguage})</li>
                <li>Interview Type ({form.interviewType})</li>
                <li>Target Job Role ({form.targetJobRole || 'Not set'})</li>
                <li>Difficulty ({form.difficulty})</li>
                <li>Focus Skills ({form.focusSkills?.length || 0})</li>
                <li>Duration ({form.durationMinutes} mins)</li>
                <li>Questions ({form.numberOfQuestions})</li>
                <li>Passing Score ({form.passingScoreThreshold}%)</li>
                <li>Expiry Date ({form.interviewExpiryDate || form.completionDeadline || 'None'})</li>
                <li>Candidate Requirements</li>
              </ul>
            </div>

            {/* Notice Callout Box */}
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex gap-3 text-xs text-primary">
              <Info className="h-5 w-5 shrink-0" />
              <p>You can review and edit all details before publishing the job.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PostJobPage;
