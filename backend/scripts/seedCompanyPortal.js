const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env') });
const mongoose = require('mongoose');
const Company = require('../models/Company');
const User = require('../models/User');
const Job = require('../models/Job');
const Application = require('../models/Application');
const Interview = require('../models/Interview');
const Assessment = require('../models/Assessment');

const seed = async () => {
  try {
    if (!process.env.MONGO_URI) {
      console.error('MONGO_URI not set');
      process.exit(1);
    }
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // 1. Create or Find Acme Inc. Company
    let company = await Company.findOne({ contactEmail: 'admin@acme.com' });
    let companyUser = await User.findOne({ email: 'admin@acme.com' });

    if (!company) {
      company = await Company.create({
        name: 'Acme Technologies',
        contactEmail: 'admin@acme.com',
        logo: 'https://via.placeholder.com/150',
        phone: '+252 61 555 1234',
        website: 'https://acme.tech',
        address: 'KM4 Square, Hodan, Mogadishu',
        description: 'Leading software development firm specializing in cloud infrastructure and AI Solutions.',
        status: 'active',
        createdBy: new mongoose.Types.ObjectId(),
      });
    }

    if (!companyUser) {
      companyUser = await User.create({
        name: 'Acme Admin',
        email: 'admin@acme.com',
        password: 'Password123!',
        role: 'company',
        company: company._id,
        accountStatus: 'active',
      });
      company.adminUser = companyUser._id;
      company.createdBy = companyUser._id;
      await company.save();
    } else {
      companyUser.role = 'company';
      companyUser.company = company._id;
      await companyUser.save();
    }

    // 2. Create Candidate Users
    const candidates = [];
    const candidateData = [
      { name: 'Amina Ali', email: 'amina.ali@example.com', targetRole: 'Senior Frontend Engineer', experienceLevel: 'senior', skills: ['React', 'TypeScript', 'Tailwind'] },
      { name: 'Hassan Mohamed', email: 'hassan.m@example.com', targetRole: 'Backend Engineer', experienceLevel: 'mid', skills: ['Node.js', 'Express', 'MongoDB'] },
      { name: 'Fatima Jama', email: 'fatima.j@example.com', targetRole: 'Product Designer', experienceLevel: 'mid', skills: ['Figma', 'UI/UX', 'Prototyping'] },
      { name: 'Omar Dahir', email: 'omar.d@example.com', targetRole: 'DevOps Engineer', experienceLevel: 'senior', skills: ['Docker', 'Kubernetes', 'AWS'] },
    ];

    for (const data of candidateData) {
      let cand = await User.findOne({ email: data.email });
      if (!cand) {
        cand = await User.create({
          name: data.name,
          email: data.email,
          password: 'Password123!',
          role: 'user',
          targetRole: data.targetRole,
          experienceLevel: data.experienceLevel,
          skills: data.skills,
        });
      }
      candidates.push(cand);
    }

    // 3. Create Sample Jobs
    await Job.deleteMany({ company: company._id });
    const jobs = await Job.create([
      {
        company: company._id,
        createdBy: companyUser._id,
        title: 'Senior React Developer',
        employmentType: 'full-time',
        workplaceType: 'hybrid',
        location: 'Mogadishu, Somalia',
        numberOfHiresNeeded: 2,
        status: 'published',
        description: 'We are seeking an experienced Senior React Developer to lead web dashboard engineering.',
        requiredSkills: ['React', 'TypeScript', 'Redux', 'Tailwind CSS'],
        experienceLevel: 'senior',
        interviewLanguage: 'English',
        durationMinutes: 45,
        numberOfQuestions: 5,
        passingScoreThreshold: 75,
      },
      {
        company: company._id,
        createdBy: companyUser._id,
        title: 'Backend Node.js Engineer',
        employmentType: 'full-time',
        workplaceType: 'remote',
        location: 'Remote',
        numberOfHiresNeeded: 1,
        status: 'published',
        description: 'Join our backend squad developing microservices and streaming socket engines.',
        requiredSkills: ['Node.js', 'MongoDB', 'Express', 'Socket.io'],
        experienceLevel: 'mid',
        interviewLanguage: 'English',
        durationMinutes: 30,
        numberOfQuestions: 5,
        passingScoreThreshold: 70,
      },
    ]);

    // 4. Create Applications
    await Application.deleteMany({ company: company._id });
    const applications = await Application.create([
      {
        job: jobs[0]._id,
        company: company._id,
        candidate: candidates[0]._id,
        candidateName: candidates[0].name,
        candidateEmail: candidates[0].email,
        resumeStatus: 'uploaded',
        coverLetter: 'I have 6 years of experience scaling React applications.',
        status: 'shortlisted',
        isShortlisted: true,
        overallScore: 88,
      },
      {
        job: jobs[1]._id,
        company: company._id,
        candidate: candidates[1]._id,
        candidateName: candidates[1].name,
        candidateEmail: candidates[1].email,
        resumeStatus: 'uploaded',
        status: 'interviewed',
        isShortlisted: false,
        overallScore: 72,
      },
      {
        job: jobs[0]._id,
        company: company._id,
        candidate: candidates[2]._id,
        candidateName: candidates[2].name,
        candidateEmail: candidates[2].email,
        resumeStatus: 'uploaded',
        status: 'applied',
        isShortlisted: false,
        overallScore: null,
      },
    ]);

    // 5. Create Interviews
    await Interview.deleteMany({ company: company._id });
    const interviews = await Interview.create([
      {
        user: candidates[0]._id,
        company: company._id,
        title: 'Senior React Developer - Technical Interview',
        difficulty: 'senior',
        domain: 'technology',
        language: 'english',
        jobRole: 'Senior React Developer',
        duration: 45,
        scheduledAt: new Date(Date.now() + 86400000 * 2), // 2 days from now
        status: 'scheduled',
        overallScore: 88,
      },
      {
        user: candidates[1]._id,
        company: company._id,
        title: 'Backend Node.js Engineer - Mixed Interview',
        difficulty: 'mid',
        domain: 'technology',
        language: 'english',
        jobRole: 'Backend Node.js Engineer',
        duration: 30,
        completedAt: new Date(),
        status: 'completed',
        overallScore: 72,
      },
    ]);

    // Link application to interview
    applications[0].interview = interviews[0]._id;
    await applications[0].save();
    applications[1].interview = interviews[1]._id;
    await applications[1].save();

    // 6. Create Assessments
    await Assessment.deleteMany({ company: company._id });
    await Assessment.create([
      {
        company: company._id,
        candidate: candidates[0]._id,
        job: jobs[0]._id,
        application: applications[0]._id,
        interview: interviews[0]._id,
        candidateName: candidates[0].name,
        assessmentType: 'TECHNICAL AI Evaluation',
        score: 88,
        passingScore: 75,
        passFailStatus: 'passed',
        summaryNotes: 'Candidate demonstrated strong mastery of React state management and asynchronous hooks.',
        strengths: ['React Hooks & Performance', 'TypeScript Type System', 'System Architecture'],
        improvements: ['Could deepen unit testing coverage knowledge'],
      },
      {
        company: company._id,
        candidate: candidates[1]._id,
        job: jobs[1]._id,
        application: applications[1]._id,
        interview: interviews[1]._id,
        candidateName: candidates[1].name,
        assessmentType: 'MIXED AI Evaluation',
        score: 72,
        passingScore: 70,
        passFailStatus: 'passed',
        summaryNotes: 'Good understanding of Express middleware and MongoDB indexing.',
        strengths: ['Express routing', 'Database design'],
        improvements: ['Memory profiling under heavy load'],
      },
    ]);

    console.log('✅ Company Portal seed data created successfully!');
    console.log('Credentials to sign in as Company user:');
    console.log('Email: admin@acme.com');
    console.log('Password: Password123!');
    process.exit(0);
  } catch (err) {
    console.error('Seed error:', err);
    process.exit(1);
  }
};

seed();
