import { JobBoard } from '@/components/landing/JobBoard';

export default function JobsPage() {
    return (
        <div
            className="landing-page-container [&>section]:pt-6 [&>section]:pb-8 [&>section]:border-y-0 [&>section]:bg-transparent"
            style={{ backgroundColor: 'transparent' }}
        >
            <JobBoard />
        </div>
    );
}
