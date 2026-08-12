import { useState } from 'react';
import {
  X,
  User,
  Mail,
  Phone,
  Upload,
  FileText,
  Calendar as CalendarIcon,
  CheckCircle2,
  AlertCircle,
  Camera,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Job } from '@/types/companyPortal';
import publicCompanyService from '@/services/publicCompanyService';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

interface JobApplicationFormModalProps {
  job: Job;
  isOpen: boolean;
  onClose: () => void;
}

const ALLOWED_PHOTO_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
const ALLOWED_RESUME_EXTS = ['.pdf', '.doc', '.docx'];
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;   // 5 MB
const MAX_RESUME_BYTES = 10 * 1024 * 1024; // 10 MB

const getExt = (name: string) => '.' + (name.split('.').pop() ?? '').toLowerCase();

const TIME_SLOTS = ['09:00 AM', '10:30 AM', '01:00 PM', '02:30 PM', '04:00 PM'];

export const JobApplicationFormModal = ({ job, isOpen, onClose }: JobApplicationFormModalProps) => {
  // Form fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  // File uploads
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [resumeFile, setResumeFile] = useState<File | null>(null);



  // Status state
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [alreadyApplied, setAlreadyApplied] = useState(false);

  if (!isOpen) return null;

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!ALLOWED_PHOTO_EXTS.includes(getExt(file.name))) {
      toast.error('Profile photo must be JPG, PNG, WEBP, or GIF');
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      toast.error('Profile photo must be under 5 MB');
      return;
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleResumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!ALLOWED_RESUME_EXTS.includes(getExt(file.name))) {
      toast.error('Resume must be a PDF, DOC, or DOCX file');
      return;
    }
    if (file.size > MAX_RESUME_BYTES) {
      toast.error('Resume must be under 10 MB');
      return;
    }
    setResumeFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Validate Always Required Fields
    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPhone = phone.trim();

    if (!trimmedName || !trimmedEmail || !trimmedPhone) {
      toast.error('Please complete all required contact fields (Full Name, Email, Phone)');
      return;
    }

    if (trimmedName.length < 2 || trimmedName.length > 100) {
      toast.error('Full Name must be between 2 and 100 characters');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      toast.error('Please enter a valid email address (e.g. name@example.com)');
      return;
    }

    const phoneDigits = trimmedPhone.replace(/\D/g, '');
    if (phoneDigits.length < 7 || phoneDigits.length > 15) {
      toast.error('Please enter a valid phone number (7 to 15 digits)');
      return;
    }

    if (!photoFile && !photoPreview) {
      toast.error('Please upload your profile photo (headshot)');
      return;
    }

    // 2. Validate Dynamic Job Requirements
    if (job.resumeRequired && !resumeFile) {
      toast.error('Resume / CV upload is mandatory for this job');
      return;
    }


    setSubmitting(true);
    try {
      let uploadedPhotoUrl = photoPreview;
      let uploadedResumeUrl = '';
      let uploadedResumeText = '';

      if (photoFile) {
        const photoResult = await publicCompanyService.uploadBlobFile(photoFile, 'photos');
        uploadedPhotoUrl = photoResult.url;
      }

      if (job.resumeRequired && resumeFile) {
        const resumeResult = await publicCompanyService.uploadBlobFile(resumeFile, 'resumes');
        uploadedResumeUrl = resumeResult.url;
        uploadedResumeText = resumeResult.resumeText || '';
      }

      await publicCompanyService.submitJobApplication(job._id, {
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        profilePhotoUrl: uploadedPhotoUrl,
        resumeUrl: job.resumeRequired ? uploadedResumeUrl : undefined,
        resumeText: job.resumeRequired ? uploadedResumeText : undefined,
      });

      setSubmitted(true);
      toast.success('Application submitted successfully!');
    } catch (err: any) {
      const status = (err as any).response?.status;
      const msg: string = (err as any).response?.data?.message || '';
      if (status === 409 || msg.toLowerCase().includes('already applied')) {
        setAlreadyApplied(true);
        return;
      }
      toast.error(msg || 'Failed to submit application');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFullName('');
    setEmail('');
    setPhone('');
    setPhotoFile(null);
    setPhotoPreview('');
    setResumeFile(null);
    setSubmitted(false);
    setAlreadyApplied(false);
    onClose();
  };



  const companyName = typeof job.company === 'object' && job.company !== null ? (job.company as any).name : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-white p-6 dark:bg-slate-900 shadow-xl border border-white-light dark:border-white-light/10 space-y-6 my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white-light dark:border-white-light/10 pb-4">
          <div>
            <h2 className="text-xl font-bold text-black dark:text-white">Apply for {job.title}</h2>
            <p className="text-xs text-white-dark mt-0.5">{companyName || 'Employer Job Requisition'}</p>
          </div>
          <button
            type="button"
            onClick={resetForm}
            className="rounded-lg p-2 text-white-dark hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {submitted ? (
          /* ─── Success Confirmation Screen ─── */
          <div className="py-8 text-center space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/10 text-success">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            <h3 className="text-2xl font-bold text-black dark:text-white">Application Submitted!</h3>
            <p className="text-sm text-white-dark max-w-md mx-auto">
              Thank you for applying for <span className="font-semibold text-black dark:text-white">{job.title}</span>. Your application has been logged and sent to the employer.
            </p>

            <div className="pt-4">
              <button type="button" onClick={resetForm} className="btn btn-primary px-8">
                Done
              </button>
            </div>
          </div>
        ) : alreadyApplied ? (
          /* ─── Already Applied Screen ─── */
          <div className="py-8 text-center space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-warning/10 text-warning">
              <AlertCircle className="h-10 w-10" />
            </div>
            <h3 className="text-2xl font-bold text-black dark:text-white">Already Applied</h3>
            <p className="text-sm text-white-dark max-w-md mx-auto">
              You have already submitted an application for{' '}
              <span className="font-semibold text-black dark:text-white">{job.title}</span>.
              Only one application per job is allowed.
            </p>
            <p className="text-xs text-white-dark max-w-sm mx-auto">
              If you believe this is a mistake, please contact the employer directly.
            </p>
            <div className="pt-4">
              <button type="button" onClick={resetForm} className="btn btn-outline-warning px-8">
                Close
              </button>
            </div>
          </div>
        ) : (
          /* ─── Application Form ─── */
          <form onSubmit={handleSubmit} className="space-y-6 max-h-[75vh] overflow-y-auto pr-2">
            {/* Section 1: Required Contact Info */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                <User className="h-4 w-4" /> Candidate Contact Details
              </h3>

              <div className="flex items-center gap-4">
                {/* Profile Photo Upload */}
                <div className="relative shrink-0">
                  {photoPreview ? (
                    <img
                      src={photoPreview}
                      alt="Profile Preview"
                      className="h-16 w-16 rounded-full object-cover border-2 border-primary"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-white-dark border border-dashed border-white-light dark:border-white-light/20">
                      <Camera className="h-6 w-6" />
                    </div>
                  )}
                  <label
                    htmlFor="photo-upload"
                    className="absolute -bottom-1 -right-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-primary text-white shadow hover:bg-primary-dark"
                    title="Upload Photo"
                  >
                    <Upload className="h-3.5 w-3.5" />
                  </label>
                  <input
                    id="photo-upload"
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,.gif"
                    className="hidden"
                    onChange={handlePhotoChange}
                  />
                </div>

                <div className="flex-1 space-y-1">
                  <label className="text-xs font-semibold text-black dark:text-white">Profile Photo *</label>
                  <p className="text-xs text-white-dark">Upload a clear professional headshot (JPG, PNG).</p>
                  {photoFile && <p className="text-xs text-success font-medium">{photoFile.name}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="form-label text-xs font-bold text-black dark:text-white">Full Name *</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-primary/70 pointer-events-none z-10" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Hassan Ahmed"
                      className="form-input !pl-10 text-sm font-medium bg-white dark:bg-[#121e32] border-[#ebedf2] dark:border-[#1b2e4b] focus:!border-primary"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label text-xs font-bold text-black dark:text-white">Email Address *</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-primary/70 pointer-events-none z-10" />
                    <input
                      type="email"
                      required
                      placeholder="hassan@example.com"
                      className="form-input !pl-10 text-sm font-medium bg-white dark:bg-[#121e32] border-[#ebedf2] dark:border-[#1b2e4b] focus:!border-primary"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="form-label text-xs font-bold text-black dark:text-white">Phone Number *</label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-primary/70 pointer-events-none z-10" />
                    <input
                      type="tel"
                      required
                      placeholder="+252 61 555 1234"
                      className="form-input !pl-10 text-sm font-medium bg-white dark:bg-[#121e32] border-[#ebedf2] dark:border-[#1b2e4b] focus:!border-primary"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                </div>
              </div>

            </div>

            {/* Section 2: Resume Upload */}
            {job.resumeRequired && (
              <div className="space-y-4 border-t border-white-light dark:border-white-light/10 pt-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                  <FileText className="h-4 w-4" /> Application Documents
                </h3>

                {/* Resume / CV Field */}
                <div className="space-y-2">
                  <label className="form-label text-xs flex items-center justify-between">
                    <span>Resume / CV (PDF, DOCX) *</span>
                    <span className="badge badge-outline-primary text-[10px]">Mandatory</span>
                  </label>

                  <div className="flex items-center gap-3">
                    <label className="btn btn-outline-primary btn-sm flex items-center gap-2 cursor-pointer">
                      <Upload className="h-4 w-4" />
                      <span>{resumeFile ? 'Change Resume File' : 'Choose Resume File'}</span>
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx"
                        className="hidden"
                        onChange={handleResumeChange}
                      />
                    </label>
                    {resumeFile && (
                      <span className="text-xs font-medium text-success flex items-center gap-1">
                        <FileText className="h-4 w-4" /> {resumeFile.name}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Submit Actions */}
            <div className="flex items-center justify-end gap-3 border-t border-white-light dark:border-white-light/10 pt-4">
              <button type="button" onClick={resetForm} className="btn btn-outline-secondary">
                Cancel
              </button>
              <button type="submit" disabled={submitting} className="btn btn-primary min-w-[140px]">
                {submitting ? (
                  <div className="flex items-center gap-2">
                    <LoadingSpinner size="sm" />
                    <span>Submitting...</span>
                  </div>
                ) : (
                  'Submit Application'
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
