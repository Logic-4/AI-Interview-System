# Graph Report - .  (2026-08-08)

## Corpus Check
- Large corpus: 605 files · ~639,095 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder.

## Summary
- 2175 nodes · 3651 edges · 267 communities (136 shown, 131 thin omitted)
- Extraction: 82% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 202 edges (avg confidence: 0.51)
- Token cost: 58,850 input · 16,980 output

## Community Hubs (Navigation)
- Kaggle Integration
- Localization & Flags
- Flag Assets
- Gemma AI Service
- Company Portal
- Company Management
- Audio Recording
- UI Components
- PDF Parsing
- Interview Controller
- Frontend Routes
- Server Setup
- Feedback & Scoring
- Navigation
- Face Verification
- TypeScript Config
- File Upload
- Waiting Room UI
- SVG Flag System
- Country Selector
- Community 20
- Community 21
- Community 22
- Community 23
- Community 24
- Community 25
- Community 26
- Community 27
- Community 28
- Community 29
- Community 30
- Community 31
- Community 32
- Community 33
- Community 34
- Community 35
- Community 36
- Community 37
- Community 38
- Community 39
- Community 40
- Community 41
- Community 42
- Community 43
- Community 44
- Community 45
- Community 46
- Community 47
- Community 48
- Community 49
- Community 50
- Community 51
- Community 52
- Community 53
- Community 54
- Community 55
- Community 56
- Community 57
- Community 58
- Community 59
- Community 60
- Community 61
- Community 62
- Community 63
- Community 64
- Community 65
- Community 66
- Community 67
- Community 68
- Community 69
- Community 70
- Community 71
- Community 72
- Community 73
- Community 74
- Community 75
- Community 76
- Community 77
- Community 78
- Community 79
- Community 80
- Community 81
- Community 82
- Community 83
- Community 84
- Community 85
- Community 86
- Community 87
- Community 88
- Community 89
- Community 90
- Community 91
- Community 92
- Community 93
- Community 94
- Community 95
- Community 96
- Community 97
- Community 98
- Community 99
- Community 100
- Community 101
- Community 102
- Community 103
- Community 104
- Community 105
- Community 106
- Community 107
- Community 108
- Community 109
- Community 110
- Community 111
- Community 112
- Community 113
- Community 114
- Community 115
- Community 116
- Community 117
- Community 118
- Community 119
- Community 120
- Community 121
- Community 122
- Community 123
- Community 124
- Community 125
- Community 126
- Community 127
- Community 128
- Community 129
- Community 130
- Community 131
- Community 132
- Community 133
- Community 134
- Community 135
- Community 136
- Community 137
- Community 138
- Community 139
- Community 140
- Community 141
- Community 142
- Community 143
- Community 144
- Community 145
- Community 146
- Community 147
- Community 148
- Community 149
- Community 150
- Community 151
- Community 152
- Community 153
- Community 154
- Community 155
- Community 156
- Community 157
- Community 158
- Community 159
- Community 160
- Community 161
- Community 162
- Community 163
- Community 164
- Community 165
- Community 166
- Community 167
- Community 168
- Community 169
- Community 170
- Community 171
- Community 172
- Community 173
- Community 174
- Community 175
- Community 176
- Community 177
- Community 178
- Community 179
- Community 180
- Community 181
- Community 182
- Community 183
- Community 184
- Community 185
- Community 189
- Community 202
- Community 205
- Community 206
- Community 207
- Community 208
- Community 209
- Community 210
- Community 211
- Community 212
- Community 213
- Community 214
- Community 215
- Community 216
- Community 217
- Community 218
- Community 219
- Community 222
- Community 223
- Community 224
- Community 225
- Community 226
- Community 227
- Community 228
- Community 229
- Community 230
- Community 231
- Community 232
- Community 233
- Community 234
- Community 235
- Community 236
- Community 237
- Community 238
- Community 239
- Community 240
- Community 241
- Community 242
- Community 243
- Community 244
- Community 245
- Community 246
- Community 247
- Community 248
- Community 249
- Community 251
- Community 264
- Community 265
- Community 266

## God Nodes (most connected - your core abstractions)
1. `Country Flag Icons` - 114 edges
2. `cn()` - 51 edges
3. `LoadingSpinner()` - 35 edges
4. `useAuthStore` - 35 edges
5. `compilerOptions` - 18 edges
6. `protect()` - 15 edges
7. `IRootState` - 14 edges
8. `callGemma()` - 13 edges
9. `submitAnswer()` - 12 edges
10. `scripts` - 12 edges

## Surprising Connections (you probably didn't know these)
- `React Vite Frontend` --uses--> `react`  [0.95]
  CLAUDE.md → frontend/package.json
- `Node.js Express Backend` --uses--> `express`  [0.95]
  CLAUDE.md → backend/package.json
- `React Vite Frontend` --uses--> `zustand`  [0.95]
  CLAUDE.md → frontend/package.json
- `React Vite Frontend` --uses--> `tailwindcss`  [0.95]
  CLAUDE.md → frontend/package.json
- `React Vite Frontend` --uses--> `vite`  [0.95]
  CLAUDE.md → frontend/package.json

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Complete Interview System Architecture** — backend, frontend, mongodb, asr_service, tts_service, gemma_service [0.95]
- **Speech Processing Services (ASR + TTS)** — asr_service, tts_service, somali_speech, english_speech [0.9]
- **Complete Interview Lifecycle** — candidate_onboarding, job_parsing, question_generation, live_interview, scoring_pipeline, feedback_generation, practice_loop, progress_tracking [0.9]
- **Interview System Data Models** — interview_context, role_profile, interview_plan, scoring_result, feedback_report [0.9]
- **Frontend Technology Stack** — react, vite, tailwindcss, zustand, radix_ui [0.95]
- **AI Models Used in System** — gemma3_model, wav2vec2_somali, whisper_turbo, kokoro [0.9]
- **Deployment and Infrastructure** — docker, runpod_serverless, mongo7 [0.9]
- **Authentication Flow Assets** — frontend/public/assets/images/auth/login, frontend/public/assets/images/auth/register, frontend/public/assets/images/auth/coming-soon-cover [0.9]
- **Coming Soon Page Visual Composition** — frontend/public/assets/images/auth/coming-soon-cover, frontend/public/assets/images/auth/coming-soon-object1, frontend/public/assets/images/auth/coming-soon-object2, frontend/public/assets/images/auth/coming-soon-object3, frontend/public/assets/images/auth/polygon-object [0.85]
- **Error Page Collection** — frontend/public/assets/images/error/404-dark, frontend/public/assets/images/error/404-light, frontend/public/assets/images/error/500-dark, frontend/public/assets/images/error/500-light, frontend/public/assets/images/error/503-dark, frontend/public/assets/images/error/503-light [0.93]
- **Theme-Aware Components** — theme-variant-pattern, frontend/public/assets/images/error/404-dark, frontend/public/assets/images/error/404-light, frontend/public/assets/images/error/500-dark, frontend/public/assets/images/error/500-light, frontend/public/assets/images/error/503-dark, frontend/public/assets/images/error/503-light, frontend/public/assets/images/faq/faq-dark, frontend/public/assets/images/faq/faq-light [0.91]
- **Illustration-Based UI Design System** — illustration-ui-pattern, frontend/public/assets/images/error/404-dark, frontend/public/assets/images/error/500-dark, frontend/public/assets/images/error/503-dark, frontend/public/assets/images/error/maintenance-dark, frontend/public/assets/images/features_overview, frontend/public/assets/images/faq/faq-dark [0.89]
- **Localization & Multi-Language Support** — frontend/public/assets/images/flags, localization-feature [0.88]
- **Flag SVG rendering pattern** — flag-standard-dimensions, linearGradient-pattern, color-gradient-syntax, svg-sketchtool-generator [0.9]
- **Country flag asset collection (A-B range)** — flag-assets-collection, frontend/public/assets/images/flags/AR, frontend/public/assets/images/flags/AS, frontend/public/assets/images/flags/AT, frontend/public/assets/images/flags/AU, frontend/public/assets/images/flags/AW, frontend/public/assets/images/flags/AX, frontend/public/assets/images/flags/AZ, frontend/public/assets/images/flags/BA, frontend/public/assets/images/flags/BB, frontend/public/assets/images/flags/BD, frontend/public/assets/images/flags/BE, frontend/public/assets/images/flags/BF, frontend/public/assets/images/flags/BG, frontend/public/assets/images/flags/BH, frontend/public/assets/images/flags/BI, frontend/public/assets/images/flags/BJ, frontend/public/assets/images/flags/BL, frontend/public/assets/images/flags/BM, frontend/public/assets/images/flags/BN, frontend/public/assets/images/flags/BO, frontend/public/assets/images/flags/BR, frontend/public/assets/images/flags/BS [0.95]
- **B-Series Flags** — flag_BT, flag_BV, flag_BW, flag_BY, flag_BZ [INFERRED]
- **C-Series Flags** — flag_CA, flag_CC, flag_CD, flag_CF, flag_CG, flag_CH, flag_CI, flag_CK, flag_CL, flag_CM, flag_CN, flag_CO, flag_CR, flag_CU, flag_CW, flag_CX, flag_CY [INFERRED]
- **Internationalization Support** — localization_feature, svg_asset_collection [INFERRED]
- **Language Localization with Flag Icons Pattern** — localization_system, language_selector_ui, flag_EN_US, flag_EN_IN, flag_DA, flag_DE, flag_EL, flag_ES, flag_FI [0.85]
- **Comprehensive Country/Region Flag Icon Set** — flag_CY, flag_CZ, flag_DJ, flag_DK, flag_DM, flag_DO, flag_DZ, flag_EC, flag_EE, flag_EG, flag_EH, flag_ER, flag_ET, flag_EU [0.9]
- **SVG Flag Design System** — svg_element_circle, svg_element_rect, svg_element_path, linear_gradient_color, color_white, color_red, color_black, color_gold, color_blue [0.9]
- **International Flag Assets Hierarchy** — country-flags-collection, frontend/public/assets/images/flags/GQ, frontend/public/assets/images/flags/GR, frontend/public/assets/images/flags/GS, frontend/public/assets/images/flags/GT, frontend/public/assets/images/flags/GU, frontend/public/assets/images/flags/GW, frontend/public/assets/images/flags/GY, frontend/public/assets/images/flags/HK, frontend/public/assets/images/flags/HM, frontend/public/assets/images/flags/HN, frontend/public/assets/images/flags/HR, frontend/public/assets/images/flags/HT, frontend/public/assets/images/flags/HU, frontend/public/assets/images/flags/ID, frontend/public/assets/images/flags/IE, frontend/public/assets/images/flags/IL, frontend/public/assets/images/flags/IM, frontend/public/assets/images/flags/IN, frontend/public/assets/images/flags/IO, frontend/public/assets/images/flags/IQ, frontend/public/assets/images/flags/IR, frontend/public/assets/images/flags/IS [0.9]
- **Chunk 08 - Flag Assets (indices 176-197)** — frontend/public/assets/images/flags/IT, frontend/public/assets/images/flags/JA, frontend/public/assets/images/flags/JE, frontend/public/assets/images/flags/JM, frontend/public/assets/images/flags/JO, frontend/public/assets/images/flags/JP, frontend/public/assets/images/flags/KE, frontend/public/assets/images/flags/KG, frontend/public/assets/images/flags/KH, frontend/public/assets/images/flags/KI, frontend/public/assets/images/flags/KM, frontend/public/assets/images/flags/KN, frontend/public/assets/images/flags/KP, frontend/public/assets/images/flags/KR, frontend/public/assets/images/flags/KW, frontend/public/assets/images/flags/KY, frontend/public/assets/images/flags/KZ, frontend/public/assets/images/flags/LA, frontend/public/assets/images/flags/LB, frontend/public/assets/images/flags/LC, frontend/public/assets/images/flags/LGBT, frontend/public/assets/images/flags/LI [0.95]
- **SVG-based Flag Rendering and Locale Selection** — svg-flag-pattern, frontend_public_assets_images_flags_collection, locale-selection-ui [0.9]
- **Country Flag Assets for Localization** — frontend/public/assets/images/flags/LK, frontend/public/assets/images/flags/LR, frontend/public/assets/images/flags/LS, frontend/public/assets/images/flags/LT, frontend/public/assets/images/flags/LU, frontend/public/assets/images/flags/LV, frontend/public/assets/images/flags/LY, frontend/public/assets/images/flags/MA, frontend/public/assets/images/flags/MC, frontend/public/assets/images/flags/MD, frontend/public/assets/images/flags/ME, frontend/public/assets/images/flags/MF, frontend/public/assets/images/flags/MG, frontend/public/assets/images/flags/MH, frontend/public/assets/images/flags/MK, frontend/public/assets/images/flags/ML, frontend/public/assets/images/flags/MM, frontend/public/assets/images/flags/MN, frontend/public/assets/images/flags/MO, frontend/public/assets/images/flags/MP, frontend/public/assets/images/flags/MQ, frontend/public/assets/images/flags/MR [INFERRED]
- **Country Flag Icons Collection** — frontend/public/assets/images/flags/MS, frontend/public/assets/images/flags/MT, frontend/public/assets/images/flags/MU, frontend/public/assets/images/flags/MV, frontend/public/assets/images/flags/MW, frontend/public/assets/images/flags/MX, frontend/public/assets/images/flags/MY, frontend/public/assets/images/flags/MZ, frontend/public/assets/images/flags/NA, frontend/public/assets/images/flags/NC, frontend/public/assets/images/flags/NE, frontend/public/assets/images/flags/NF, frontend/public/assets/images/flags/NG, frontend/public/assets/images/flags/NI, frontend/public/assets/images/flags/NL, frontend/public/assets/images/flags/NO, frontend/public/assets/images/flags/NP, frontend/public/assets/images/flags/NR, frontend/public/assets/images/flags/NU, frontend/public/assets/images/flags/NZ, frontend/public/assets/images/flags/OM, frontend/public/assets/images/flags/PA [0.95]
- **SVG Flag Design Pattern** — svg-flag-asset-type [0.9]
- **SVG Flag Asset System** — asset-directory:country-flags, svg-design:flag-pattern, color-element:flag-gradient [0.9]
- **Country Selection UI Assets** — asset-directory:country-flags, country-code:PE, country-code:PF, country-code:PG, country-code:PH, country-code:PK, country-code:PL, country-code:PM, country-code:PN, country-code:PR, country-code:PS, country-code:PT, country-code:PW, country-code:PY, country-code:QA, country-code:RE, country-code:RH, country-code:RO, country-code:RS, country-code:RU, country-code:RW, country-code:SA, country-code:SB [0.95]
- **Flag Icons Collection** — frontend/public/assets/images/flags/SC, frontend/public/assets/images/flags/SD, frontend/public/assets/images/flags/SE, frontend/public/assets/images/flags/SG, frontend/public/assets/images/flags/SH, frontend/public/assets/images/flags/SI, frontend/public/assets/images/flags/SJ, frontend/public/assets/images/flags/SK, frontend/public/assets/images/flags/SL, frontend/public/assets/images/flags/SM, frontend/public/assets/images/flags/SN, frontend/public/assets/images/flags/SO, frontend/public/assets/images/flags/SR, frontend/public/assets/images/flags/SS, frontend/public/assets/images/flags/ST, frontend/public/assets/images/flags/SV, frontend/public/assets/images/flags/SV1, frontend/public/assets/images/flags/SX, frontend/public/assets/images/flags/SY, frontend/public/assets/images/flags/SZ, frontend/public/assets/images/flags/TC [0.95]
- **Country Flag Icon Collection** — frontend/public/assets/images/flags/TF, frontend/public/assets/images/flags/TG, frontend/public/assets/images/flags/TH, frontend/public/assets/images/flags/TJ, frontend/public/assets/images/flags/TK, frontend/public/assets/images/flags/TL, frontend/public/assets/images/flags/TM, frontend/public/assets/images/flags/TN, frontend/public/assets/images/flags/TO, frontend/public/assets/images/flags/TR, frontend/public/assets/images/flags/TT, frontend/public/assets/images/flags/TV, frontend/public/assets/images/flags/TW, frontend/public/assets/images/flags/TZ, frontend/public/assets/images/flags/UG, frontend/public/assets/images/flags/UK, frontend/public/assets/images/flags/UK1, frontend/public/assets/images/flags/UM, frontend/public/assets/images/flags/US-CA, frontend/public/assets/images/flags/US, frontend/public/assets/images/flags/UY, frontend/public/assets/images/flags/UZ [0.95]
- **SVG Flag Rendering System** —  [0.9]
- **Flag Rendering System** —  [0.85]
- **Knowledge Base Visual Assets** —  [0.85]
- **Internationalization Asset Pattern** —  [0.8]
- **Knowledge Base Image Assets** — frontend/public/assets/images/knowledge/image-5, frontend/public/assets/images/knowledge/image-6, frontend/public/assets/images/knowledge/image-7, frontend/public/assets/images/knowledge/image-8, frontend/public/assets/images/knowledge/pattern [0.9]
- **Gallery/Lightbox Images** — frontend/public/assets/images/lightbox2, frontend/public/assets/images/lightbox3, frontend/public/assets/images/lightbox4, frontend/public/assets/images/lightbox5, frontend/public/assets/images/lightbox6 [0.85]
- **Theme-Aware Background Assets** — frontend/public/assets/images/map, frontend/public/assets/images/map-dark [0.9]

## Communities (267 total, 131 thin omitted)

### Community 0 - "Kaggle Integration"
Cohesion: 0.05
Nodes (58): getKaggleConfig(), kaggleService, SystemConfig, updateKaggleConfig(), mongoose, systemConfigSchema, express, { getKaggleConfig, updateKaggleConfig } (+50 more)

### Community 1 - "Localization & Flags"
Cohesion: 0.03
Nodes (64): Country/Locale Selection Feature, Country/Region Localization Support, Czech Republic Flag (CZ), Danish Language Flag (DA), Djibouti Flag (DJ), Denmark Flag (DK), Dominica Flag (DM), Dominican Republic Flag (DO) (+56 more)

### Community 2 - "Flag Assets"
Cohesion: 0.04
Nodes (47): Country Flag Icons (P-S), Linear Gradient Color System, Peru, French Polynesia, Papua New Guinea, Philippines, Pakistan, Poland (+39 more)

### Community 3 - "Gemma AI Service"
Cohesion: 0.07
Nodes (40): Gemma-3 Technical Interviewer, Gemma Interview Worker, Hugging Face Hub, RunPod, RunPod Serverless GPU, Gemma Interview Worker Documentation, handler(), RunPod Serverless entrypoint for Gemma interview inference. IMPORTANT: Do not… (+32 more)

### Community 4 - "Company Portal"
Cohesion: 0.06
Nodes (38): ApiError, ApiResponse, Application, approveApplicationRecord(), Assessment, { buildInterviewPayload }, Candidate, Company (+30 more)

### Community 5 - "Company Management"
Cohesion: 0.11
Nodes (38): resetPassword(), deleteCompany(), getCompany(), resetCompanyPassword(), updateCompany(), updateCompanyStatus(), approveApplication(), cancelInterview() (+30 more)

### Community 6 - "Audio Recording"
Cohesion: 0.08
Nodes (35): AudioRecorderActions, AudioRecorderState, useAudioRecorder(), AnalysisStage, buildFarewellMessage(), buildWelcomeMessage(), ChatMessage, ConversationEngineReturn (+27 more)

### Community 7 - "UI Components"
Cohesion: 0.07
Nodes (26): Avatar, AvatarProps, avatarVariants, Button, ButtonProps, EmptyState(), EmptyStateProps, Input (+18 more)

### Community 8 - "PDF Parsing"
Cohesion: 0.09
Nodes (33): react, DefaultLayout(), parsePdfFile(), parseResumeFile(), parseWordFile(), SUPPORTED_EXTENSIONS, estimateQuestionCount(), DIFFICULTY_LEVELS (+25 more)

### Community 9 - "Interview Controller"
Cohesion: 0.08
Nodes (35): activeGenerations, ApiError, ApiResponse, Application, assertInterviewStillExists(), buildFallbackFirstQuestion(), CATEGORY_CYCLES, createInterview() (+27 more)

### Community 10 - "Frontend Routes"
Cohesion: 0.06
Nodes (33): AnalyticsPage, AuthCallbackPage, CompaniesPage, CompanyAssessmentsPage, CompanyCandidatesPage, CompanyDashboardPage, CompanyInterviewsPage, CompanyJobsPage (+25 more)

### Community 11 - "Server Setup"
Cohesion: 0.06
Nodes (32): allowedOrigins, app, authRoutes, { checkMaintenance }, companyPortalRoutes, connectDB, cookieParser, cors (+24 more)

### Community 12 - "Feedback & Scoring"
Cohesion: 0.10
Nodes (27): ApiError, ApiResponse, { calculateOverallScore, isScorable }, Feedback, { generateComprehensiveFeedback, isPlaceholderAnswer }, generateFeedback(), getFeedback(), getUserProgress() (+19 more)

### Community 13 - "Navigation"
Cohesion: 0.14
Nodes (17): links, Footer(), Header(), Setting(), Sidebar(), Portals(), DAILY_TIPS, DashboardPage() (+9 more)

### Community 14 - "Face Verification"
Cohesion: 0.12
Nodes (26): ApiError, ApiResponse, Application, buildStatusPayload(), {
  compareFaces,
  isVerificationEnabled,
  resolveProvider,
  getMatchThreshold,
}, Interview, logEvent(), logger (+18 more)

### Community 15 - "TypeScript Config"
Cohesion: 0.07
Nodes (28): compilerOptions, allowJs, allowSyntheticDefaultImports, baseUrl, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, jsx (+20 more)

### Community 16 - "File Upload"
Cohesion: 0.11
Nodes (24): ApiError, ApiResponse, uploadAudioAnswer(), uploadInterviewRecording(), { uploadRecording, uploadAudio, uploadAvatar }, uploadUserAvatar(), updateAvatar(), express (+16 more)

### Community 17 - "Waiting Room UI"
Cohesion: 0.13
Nodes (22): formatCountdown(), InterviewWaitingRoom(), InterviewWaitingRoomProps, ProctoringOverlay(), ProctoringStatusBadge(), Props, StatusBadgeProps, StrikeIndicator() (+14 more)

### Community 18 - "SVG Flag System"
Cohesion: 0.08
Nodes (27): Color gradient syntax with stop-color and offset attributes, Country flags SVG collection, Standard flag SVG dimensions (21x15 px, viewBox 0 0 21 15), Argentina flag SVG, American Samoa flag SVG, Austria flag SVG, Australia flag SVG, Aruba flag SVG (+19 more)

### Community 19 - "Country Selector"
Cohesion: 0.08
Nodes (26): Country Selection UI, Flag Icon Asset Pattern, TF Flag SVG (French Southern Territories), TG Flag SVG (Togo), TH Flag SVG (Thailand), TJ Flag SVG (Tajikistan), TK Flag SVG (Tokelau), TL Flag SVG (Timor-Leste) (+18 more)

### Community 20 - "Community 20"
Cohesion: 0.17
Nodes (15): SocialAuth(), ThemeToggle(), getApiBaseUrl(), getGoogleAuthUrl(), sanitizeRedirectPath(), forgetGoogleAccount(), getRememberedGoogleAccounts(), readAccounts() (+7 more)

### Community 21 - "Community 21"
Cohesion: 0.09
Nodes (21): ApiError, ApiResponse, Feedback, getDashboard(), getProfile(), Interview, Question, Session (+13 more)

### Community 22 - "Community 22"
Cohesion: 0.08
Nodes (25): Country and Regional Flags Asset Collection, Equatorial Guinea Flag SVG, Greece Flag SVG, South Georgia Flag SVG, Guatemala Flag SVG, Guam Flag SVG, Guinea-Bissau Flag SVG, Guyana Flag SVG (+17 more)

### Community 23 - "Community 23"
Cohesion: 0.08
Nodes (25): Italy Flag (SVG), Flag Asset JA (SVG), Jersey Flag (SVG), Jamaica Flag (SVG), Jordan Flag (SVG), Japan Flag - Nippon (SVG), Kenya Flag (SVG), Kyrgyzstan Flag (SVG) (+17 more)

### Community 24 - "Community 24"
Cohesion: 0.13
Nodes (19): Progress, ProgressProps, PERIOD_MAP, CATEGORY_LABELS, formatTime(), getScoreColor(), getScoreLabel(), InterviewReportPage() (+11 more)

### Community 25 - "Community 25"
Cohesion: 0.10
Nodes (17): api, AuthData, LoginPayload, RegisterPayload, AuthData, AuthState, ApiError, ApiResponse (+9 more)

### Community 26 - "Community 26"
Cohesion: 0.18
Nodes (23): ApiError, ApiResponse, Company, crypto, { generateAccessToken, generateRefreshToken, verifyRefreshToken, getTokenExpiry, getExpiryMs, verifyInterviewLinkToken }, getRefreshCookieOptions(), getRefreshDuration(), logger (+15 more)

### Community 27 - "Community 27"
Cohesion: 0.09
Nodes (20): Feedback, feedbackSchema, mongoose, mongoose, Question, questionSchema, AI_FEEDBACK, daysAgo() (+12 more)

### Community 28 - "Community 28"
Cohesion: 0.09
Nodes (23): Flag Icons Asset Collection, Fiji Flag SVG, Falkland Islands Flag SVG, Micronesia Flag SVG, Faroe Islands Flag SVG, France Flag SVG, Gabon Flag SVG, United Kingdom Flag SVG (+15 more)

### Community 29 - "Community 29"
Cohesion: 0.09
Nodes (23): Bhutan Flag (BT), Bouvet Island Flag (BV), Botswana Flag (BW), Belarus Flag (BY), Belize Flag (BZ), Canada Flag (CA), Cocos Islands Flag (CC), Congo-Kinshasa Flag (CD) (+15 more)

### Community 30 - "Community 30"
Cohesion: 0.12
Nodes (13): Capabilities(), domains, items, Companies(), companyFeatures, CTA(), Features, Footer() (+5 more)

### Community 31 - "Community 31"
Cohesion: 0.27
Nodes (20): forgotPassword(), escapeHtml(), formatInterviewDateTime(), getBrandConfig(), getClientUrl(), logger, renderEmailLayout(), sendApplicationApprovedEmail() (+12 more)

### Community 32 - "Community 32"
Cohesion: 0.14
Nodes (19): estimatePose(), GazeTrackingState, GazeViolation, GazeViolationType, loadFaceLandmarker(), MediaPipeFaceLandmarker, useGazeTracking(), UseGazeTrackingOptions (+11 more)

### Community 33 - "Community 33"
Cohesion: 0.10
Nodes (21): autoprefixer, devDependencies, autoprefixer, i18next-browser-languagedetector, i18next-http-backend, postcss, react-animate-height, react-i18next (+13 more)

### Community 34 - "Community 34"
Cohesion: 0.13
Nodes (18): getWarmupStatus(), getIdentityStatus(), requiresVerification(), resolveReference(), verifyIdentity(), { aiLimiter }, {
  createInterview,
  warmInterviewServices,
  getWarmupStatus,
  getInterviews,
  getInterview,
  getInterviewProgress,
  retryQuestionGeneration,
  startInterview,
  uploadRecordingChunk,
  submitAnswer,
  completeInterview,
  deleteInterview,
  retryEvaluate,
  reevaluateAnswer,
  resetInterview,
  reportProctoringEvent,
}, { createInterviewValidator, submitAnswerValidator, listInterviewsValidator } (+10 more)

### Community 35 - "Community 35"
Cohesion: 0.11
Nodes (20): Country Selection Feature, Country Flag Assets Collection, Vatican City Flag SVG, Saint Vincent and Grenadines Flag SVG, Venezuela Flag SVG, British Virgin Islands Flag SVG, US Virgin Islands Flag SVG, Vietnam Flag SVG (+12 more)

### Community 36 - "Community 36"
Cohesion: 0.11
Nodes (19): dependencies, ai-interview-system-root, cors, dotenv, express-rate-limit, helmet, jsonwebtoken, mongoose (+11 more)

### Community 37 - "Community 37"
Cohesion: 0.13
Nodes (16): crypto, ffmpeg, ffmpegPath, fs, os, path, transcodeToWav(), getClient() (+8 more)

### Community 38 - "Community 38"
Cohesion: 0.19
Nodes (15): JobApplicationFormModal(), JobApplicationFormModalProps, TIME_SLOTS, formatDate(), PublicCompanyProfilePage(), formatDate(), PublicJobDetailsPage(), BlobUploadResult (+7 more)

### Community 39 - "Community 39"
Cohesion: 0.20
Nodes (14): blankForm, CompaniesPage(), dateTime(), errorMessage(), statusBadge(), formatDate(), SuperadminDashboardPage(), CompaniesResponse (+6 more)

### Community 40 - "Community 40"
Cohesion: 0.19
Nodes (16): Librosa, ndarray, Path, handler(), Somali Speech Service Dependencies, dispatch(), handle_transcribe(), load_asr() (+8 more)

### Community 41 - "Community 41"
Cohesion: 0.15
Nodes (15): getMe(), { authLimiter }, express, { googleRedirect, googleCallback }, { protect }, { register, login, refreshToken, logout, getMe, validateSession, forgotPassword, resetPassword, redeemInterviewLink }, { registerValidator, loginValidator, refreshTokenValidator, forgotPasswordValidator, resetPasswordValidator }, router (+7 more)

### Community 42 - "Community 42"
Cohesion: 0.15
Nodes (11): deleteInterview(), resetInterview(), startInterview(), transcribe(), synthesize(), authorize(), protect(), requireCompanyAccess() (+3 more)

### Community 43 - "Community 43"
Cohesion: 0.15
Nodes (15): Application, applyPublicJob(), Company, getPublicCompanyJobs(), getPublicCompanyProfile(), getPublicJobDetails(), Job, mongoose (+7 more)

### Community 44 - "Community 44"
Cohesion: 0.16
Nodes (10): App(), GuestRoute(), BlankLayout(), finalRoutes, GUEST_PATHS, PROTECTED_PATHS, router, routes (+2 more)

### Community 45 - "Community 45"
Cohesion: 0.21
Nodes (10): ProtectedRoute(), RoleProtectedRoute(), SuperadminEntryRoute(), InterviewLinkPage(), ProfilePage(), SettingsPage(), SuperadminLoginPage(), errorMessage() (+2 more)

### Community 46 - "Community 46"
Cohesion: 0.19
Nodes (11): approvalBadge(), CompanyCandidatesPage(), dateShort(), ProfileModal(), statusBadge(), approvalBadge(), CompanyShortlistPage(), dateShort() (+3 more)

### Community 47 - "Community 47"
Cohesion: 0.32
Nodes (15): get, post, Request, api_feedback(), api_generate_question(), api_generate_questions(), api_interview_turn(), api_parse() (+7 more)

### Community 48 - "Community 48"
Cohesion: 0.23
Nodes (15): ASR_TIMEOUT_MS, callSpeechRunPod(), geminiSpeechService, getAsrBaseUrl(), getRunPodEndpointBase(), isRunPodUrl(), logger, normalizeLanguage() (+7 more)

### Community 49 - "Community 49"
Cohesion: 0.15
Nodes (11): Badge(), BadgeProps, Skeleton(), DOMAIN_LABELS, DOMAIN_ROLES, DOMAINS, QUESTION_CATEGORIES, TECHNOLOGY_SPECIALIZATIONS (+3 more)

### Community 50 - "Community 50"
Cohesion: 0.13
Nodes (15): AI Mock Interview Training System, Candidate Onboarding, Feedback Generation, FeedbackReport, InterviewContext, Interview Flow, InterviewPlan, Job Description Parsing (+7 more)

### Community 51 - "Community 51"
Cohesion: 0.17
Nodes (15): Automatic Speech Recognition (ASR), Node.js Express Backend, express, Candidate-Facing Application, Docker Compose Configuration, English Speech Services (Whisper + Kokoro), express, Kokoro TTS (+7 more)

### Community 52 - "Community 52"
Cohesion: 0.14
Nodes (11): ApiError, ApiResponse, Company, createCompany(), dashboard(), Interview, listCompanies(), normalizePagination() (+3 more)

### Community 53 - "Community 53"
Cohesion: 0.14
Nodes (11): ApiError, ApiResponse, { generateAccessToken, generateRefreshToken, getTokenExpiry, getExpiryMs }, User, ApiError, ApiResponse, User, bcrypt (+3 more)

### Community 54 - "Community 54"
Cohesion: 0.21
Nodes (11): CompanyDashboardPage(), dateTime(), defaultForm, CompanyDashboardData, companyService, PaginatedResponse, Application, CompanyDashboardMetrics (+3 more)

### Community 55 - "Community 55"
Cohesion: 0.21
Nodes (12): initializeSocket(), logger, { Server }, { verifyAccessToken }, generateInterviewLinkToken(), getAccessExpiresIn(), getAccessSecret(), getInterviewLinkSecret() (+4 more)

### Community 56 - "Community 56"
Cohesion: 0.14
Nodes (12): ApiError, validate(), { validationResult }, { body, param, query }, companyPayload, controller, express, { protect, authorize } (+4 more)

### Community 57 - "Community 57"
Cohesion: 0.16
Nodes (11): mongoose, Session, sessionSchema, initializeSocketHandlers(), logger, { registerInterviewHandlers }, Interview, logger (+3 more)

### Community 58 - "Community 58"
Cohesion: 0.24
Nodes (13): shutdown(), attachLogs(), { getSomaliSpeechSettings, splitPythonCommand }, isServiceHealthy(), killChild(), { spawn }, spawnAsr(), spawnPythonService() (+5 more)

### Community 59 - "Community 59"
Cohesion: 0.22
Nodes (11): ConversationEngineConfig, formatTime(), getScoreColor(), InterviewReviewPage(), InterviewState, PopulatedInterview, EvaluationStatus, Question (+3 more)

### Community 60 - "Community 60"
Cohesion: 0.16
Nodes (9): CATEGORY_LABEL, CompanyAssessmentsPage(), dateTime(), dateTimeShort(), ProctoringLog(), VIOLATION_LABEL, CompanyAssessment, ProctoringViolation (+1 more)

### Community 61 - "Community 61"
Cohesion: 0.14
Nodes (13): ApprovalStatus, CategoryScoreEntry, CompanyInterviewStatus, EmploymentType, ExperienceLevel, IdentityVerificationStatus, InterviewLanguage, InterviewType (+5 more)

### Community 62 - "Community 62"
Cohesion: 0.17
Nodes (9): ApiError, Company, { stageTimer }, User, { verifyAccessToken }, ApiError, Company, companySchema (+1 more)

### Community 63 - "Community 63"
Cohesion: 0.15
Nodes (10): ApiError, logger, crypto, logger, requestContext(), logDir, logFormat, logger (+2 more)

### Community 64 - "Community 64"
Cohesion: 0.18
Nodes (10): authLimiter, createLimiter(), generalLimiter, rateLimit, { authLimiter }, express, { login }, { loginValidator } (+2 more)

### Community 65 - "Community 65"
Cohesion: 0.15
Nodes (10): assessmentSchema, mongoose, Application, Assessment, Company, Interview, Job, mongoose (+2 more)

### Community 66 - "Community 66"
Cohesion: 0.21
Nodes (12): createServiceState(), expireStaleServices(), getInterviewWarmupStatus(), logger, resetForTest(), runServiceWarmup(), snapshot(), state (+4 more)

### Community 67 - "Community 67"
Cohesion: 0.21
Nodes (13): HTTP 404 Not Found Error, HTTP 500 Server Error, HTTP 503 Service Unavailable, 404 Error Page (Dark Theme), 404 Error Page (Light Theme), 500 Server Error Page (Dark), 500 Server Error Page (Light), 503 Service Unavailable Page (Dark) (+5 more)

### Community 68 - "Community 68"
Cohesion: 0.21
Nodes (7): CamState, CheckState, InterviewLobby(), InterviewLobbyProps, LoadingSpinner(), LoadingSpinnerProps, interviewService

### Community 69 - "Community 69"
Cohesion: 0.17
Nodes (12): scripts, benchmark:pipeline, dev, lint, migrate:core-product, seed:company, seed:demo, seed:superadmin (+4 more)

### Community 70 - "Community 70"
Cohesion: 0.26
Nodes (12): Black Color, Blue Color (various shades), Gold/Yellow Color, Red Color (various shades), White Color (#FFFFFF), Cyprus Flag (CY), Germany Flag (DE), English (USA) Language Flag (EN-US) (+4 more)

### Community 71 - "Community 71"
Cohesion: 0.18
Nodes (11): apexcharts, dependencies, ai-interview-system-root, apexcharts, @monaco-editor/react, pdfjs-dist, react-redux, ai-interview-system-root (+3 more)

### Community 72 - "Community 72"
Cohesion: 0.20
Nodes (9): CLIENT_URL, { generateAccessToken, generateRefreshToken, getTokenExpiry }, googleCallback(), googleRedirect(), logger, User, assert, { googleRedirect } (+1 more)

### Community 73 - "Community 73"
Cohesion: 0.20
Nodes (9): ApiError, logger, multer, { transcribeAudio }, upload, express, { protect }, router (+1 more)

### Community 74 - "Community 74"
Cohesion: 0.20
Nodes (9): controller, express, { jobValidationRules }, { protect }, { requireCompanyAccess }, router, validate, { body } (+1 more)

### Community 75 - "Community 75"
Cohesion: 0.18
Nodes (10): description, engines, node, main, name, scripts, heroku-postbuild, seed:superadmin (+2 more)

### Community 76 - "Community 76"
Cohesion: 0.31
Nodes (9): { generateInterviewQuestions }, main(), measure(), path, percentile(), summary(), synthesizeSpeech(), { synthesizeSpeechStream } (+1 more)

### Community 77 - "Community 77"
Cohesion: 0.31
Nodes (9): { execFileSync }, fs, getSomaliSpeechSettings(), isWorkingPython(), parsePortFromUrl(), path, resolvePython(), trimBaseUrl() (+1 more)

### Community 78 - "Community 78"
Cohesion: 0.31
Nodes (9): Authentication UI Section, Coming Soon Cover SVG, Coming Soon Decoration Object 1, Coming Soon Decoration Object 2, Coming Soon Decoration Object 3, Login Page Illustration SVG, Logo White SVG, Polygon Decoration SVG (+1 more)

### Community 79 - "Community 79"
Cohesion: 0.22
Nodes (7): ApiError, { stageTimer }, { synthesizeSpeechStream }, express, { protect }, router, { synthesize }

### Community 80 - "Community 80"
Cohesion: 0.22
Nodes (6): applicationSchema, mongoose, Application, assert, controller, test

### Community 81 - "Community 81"
Cohesion: 0.22
Nodes (9): React Vite Frontend, Frontend HTML Entry Point, zustand, tailwindcss, vite, Radix UI, tailwindcss, vite (+1 more)

### Community 82 - "Community 82"
Cohesion: 0.22
Nodes (8): name, private, scripts, build, dev, preview, type, version

### Community 83 - "Community 83"
Cohesion: 0.22
Nodes (8): Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow

### Community 84 - "Community 84"
Cohesion: 0.29
Nodes (5): logger, mongoose, connectDB, run(), User

### Community 85 - "Community 85"
Cohesion: 0.29
Nodes (4): checkMaintenance(), assert, { checkMaintenance }, { test, describe, before, after }

### Community 86 - "Community 86"
Cohesion: 0.25
Nodes (7): DialogContent, DialogDescription, DialogFooter(), DialogHeader(), DialogOverlay, DialogTitle, ModalProps

### Community 87 - "Community 87"
Cohesion: 0.25
Nodes (7): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, include, vite.config.ts

### Community 88 - "Community 88"
Cohesion: 0.38
Nodes (6): uploadCandidateBlobFile(), logger, mammoth, normalizeText(), parseResumeBuffer(), pdfParse

### Community 89 - "Community 89"
Cohesion: 0.29
Nodes (6): author, description, license, main, name, version

### Community 90 - "Community 90"
Cohesion: 0.33
Nodes (6): keywords, ai, gemma, interview, mock-interview, training

### Community 91 - "Community 91"
Cohesion: 0.33
Nodes (3): assert, test, warmup

### Community 92 - "Community 92"
Cohesion: 0.33
Nodes (6): Find Solution Icon SVG, Knowledge Section Image 1, Knowledge Section Image 2, Knowledge Section Image 3, Knowledge Section Image 4, Knowledge Section Assets Collection

### Community 93 - "Community 93"
Cohesion: 0.40
Nodes (5): Modal(), CompanySecurityEventsPage(), dateTime(), OUTCOME_LABEL, SEVERITY_BADGE

### Community 94 - "Community 94"
Cohesion: 0.53
Nodes (5): CompanyInterviewsPage(), dateTime(), dateTimeShort(), statusBadge(), VIOLATION_LABEL

### Community 95 - "Community 95"
Cohesion: 0.40
Nodes (5): devDependencies, eslint, nodemon, eslint, nodemon

### Community 96 - "Community 96"
Cohesion: 0.60
Nodes (4): CompanyJobsPage(), dateTime(), statusBadge(), JobStatus

### Community 98 - "Community 98"
Cohesion: 0.40
Nodes (4): Notification, NotificationState, NotificationType, useNotificationStore

### Community 99 - "Community 99"
Cohesion: 0.50
Nodes (3): Interview, interviewSchema, mongoose

### Community 100 - "Community 100"
Cohesion: 0.50
Nodes (4): Image Carousel Assets, Carousel Image 3 JPEG, Drag Carousel Image 1 JPEG, Drag Carousel Image 2 JPEG

### Community 101 - "Community 101"
Cohesion: 0.50
Nodes (4): American Express Card Icon SVG, Mastercard Icon SVG, Visa Card Icon SVG, Payment Card Icons Collection

### Community 102 - "Community 102"
Cohesion: 0.50
Nodes (4): Montserrat Flag SVG, Nigeria Flag SVG, New Zealand Flag SVG, SVG Flag Asset Format

### Community 103 - "Community 103"
Cohesion: 0.50
Nodes (3): extends, next/core-web-vitals, next/typescript

### Community 106 - "Community 106"
Cohesion: 0.67
Nodes (3): Checked Icon SVG, Close Icon SVG, Common UI Icons

## Knowledge Gaps
- **1014 isolated node(s):** `mongoose`, `logger`, `{ Server }`, `logger`, `{ verifyAccessToken }` (+1009 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **131 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `PDF Parsing` to `Waiting Room UI`, `Community 71`?**
  _High betweenness centrality (0.091) - this node is a cross-community bridge._
- **Why does `cn()` connect `Waiting Room UI` to `Community 68`, `Audio Recording`, `UI Components`, `PDF Parsing`, `Community 49`, `Community 83`, `Community 20`, `Community 86`, `Community 24`, `Community 59`?**
  _High betweenness centrality (0.063) - this node is a cross-community bridge._
- **Why does `dependencies` connect `Community 71` to `PDF Parsing`, `Community 145`, `Community 146`, `Community 147`, `Community 151`, `Community 152`, `Community 153`, `Community 154`, `Community 155`, `Community 156`, `Community 157`, `Community 158`, `Community 159`, `Community 160`, `Community 161`, `Community 162`, `Community 163`, `Community 164`, `Community 165`, `Community 166`, `Community 167`, `Community 168`, `Community 169`, `Community 170`, `Community 171`, `Community 172`, `Community 173`, `Community 174`, `Community 175`, `Community 176`, `Community 177`, `Community 178`, `Community 81`, `Community 82`, `Community 109`, `Community 121`, `Community 122`?**
  _High betweenness centrality (0.059) - this node is a cross-community bridge._
- **What connects `mongoose`, `logger`, `{ Server }` to the rest of the system?**
  _1014 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Kaggle Integration` be split into smaller, more focused modules?**
  _Cohesion score 0.05314685314685315 - nodes in this community are weakly interconnected._
- **Should `Localization & Flags` be split into smaller, more focused modules?**
  _Cohesion score 0.031746031746031744 - nodes in this community are weakly interconnected._
- **Should `Flag Assets` be split into smaller, more focused modules?**
  _Cohesion score 0.0425531914893617 - nodes in this community are weakly interconnected._