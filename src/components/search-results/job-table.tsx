'use client';

import React from 'react';
import { motion } from 'framer-motion';
import JobCard from './job-card';
import JobDescription from './job-description';
import { Job } from '@/types/Job';
import { Star } from 'lucide-react';
import { toast } from 'sonner';

import { deleteSavedJob, saveJob } from '@/app/dashboard/search-results/action';

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

interface JobTableProps {
  jobs: Job[];
  selectedJob: Job | null;
  setSelectedJob: (job: Job | null) => void;
  updateSavedJob: (jobs: Job) => void;
}

const JobTable = ({ jobs, selectedJob, setSelectedJob, updateSavedJob }: JobTableProps) => {
  const handleClick = async (job: Job) => {
    const saved = !job.saved;
    const updatedJob = { ...job, saved };

    const result = saved ? await saveJob(updatedJob) : await deleteSavedJob(job.jobId);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    updateSavedJob(updatedJob);
  };

  return (
    <>
      <div className="grid grid-cols-1 gap-4 max-h-full overflow-y-auto pr-2">
        {jobs.map((job, index) => (
          <motion.div
            key={index}
            variants={cardVariants}
            initial="hidden"
            whileInView="visible"
            onClick={() => setSelectedJob(job)}
            viewport={{ once: false, amount: 0.1 }}
            transition={{ duration: 0.3, delay: index * 0.02 }}
            className="bg-white w-lg shadow-md rounded-lg p-4 hover:shadow-lg hover:bg-purple-100  transition-shadow duration-200 cursor-pointer"
          >
            <JobCard job={job} />
            <div className=" flex fill-purple-600">
              <Star
                fill={job.saved ? 'purple' : 'none'}
                onClick={() => void handleClick(job)}
                style={{ cursor: 'pointer' }}
              />
            </div>
          </motion.div>
        ))}
      </div>
      <div className="h-full w-2xl overflow-y-scroll">
        <JobDescription job={selectedJob}></JobDescription>
      </div>
    </>
  );
};

export default JobTable;
