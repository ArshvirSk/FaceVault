'use client'

import Link from 'next/link'

const GITHUB_PATH = "M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"
const LINKEDIN_PATH = "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white overflow-hidden">

      {/* ── Navbar ─────────────────────────────────────────── */}
      <nav className="bg-white/90 backdrop-blur-md border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center gap-2.5">
              <img src="/logo-black.png" alt="FaceVault" className="w-8 h-8 object-contain" />
              <span className="text-xl font-bold text-gray-900">FaceVault</span>
            </Link>
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Features</a>
              <a href="#how-it-works" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">How it works</a>
              <a
                href="https://github.com/ArshvirSk/FaceVault"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gray-500 hover:text-gray-900 transition-colors flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d={GITHUB_PATH} /></svg>
                GitHub
              </a>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/auth/login" className="hidden sm:block text-sm text-gray-600 hover:text-gray-900 transition-colors font-medium">
                Sign in
              </Link>
              <Link
                href="/dashboard"
                className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors font-medium"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────── */}
      <div className="relative bg-gradient-to-br from-blue-50 via-indigo-50/60 to-white pt-24 pb-16 overflow-hidden">
        {/* Decorative blobs */}
        <div className="pointer-events-none absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full bg-blue-200/40 blur-[100px]" />
        <div className="pointer-events-none absolute -top-16 right-0 w-[400px] h-[400px] rounded-full bg-purple-200/40 blur-[90px]" />
        <div className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 w-[700px] h-[300px] rounded-full bg-indigo-100/50 blur-[80px]" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-blue-200 bg-white/80 text-xs text-blue-600 font-medium mb-8 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            Open Source · MIT License · Made by Arshvir Singh Kalsi
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-gray-900 mb-6 leading-tight">
            Your Photos,{' '}
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Organized
            </span>
            <br />by Faces.
          </h1>
          <p className="text-lg text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed">
            FaceVault uses advanced AI to automatically detect, recognize, and organize your photos
            by the people in them. Everything runs{' '}
            <strong className="text-gray-900 font-semibold">100% locally</strong> — your photos never leave your device.
          </p>

          <div className="flex flex-wrap gap-4 justify-center mb-6">
            <Link
              href="/dashboard"
              className="px-7 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-base shadow-lg shadow-blue-500/25 transition-all hover:-translate-y-0.5"
            >
              Get Started Free
            </Link>
            <a
              href="https://github.com/ArshvirSk/FaceVault"
              target="_blank"
              rel="noopener noreferrer"
              className="px-7 py-3.5 bg-white hover:bg-gray-50 text-gray-800 rounded-xl font-semibold text-base border border-gray-200 shadow-sm transition-all hover:-translate-y-0.5 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d={GITHUB_PATH} /></svg>
              View on GitHub
            </a>
          </div>

          <p className="text-sm text-gray-500 mb-16">
            Created by{' '}
            <a
              href="https://github.com/ArshvirSk"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-700 hover:text-blue-600 transition-colors underline underline-offset-2"
            >
              Arshvir Singh Kalsi
            </a>
          </p>

          {/* Browser mockup */}
          <div className="relative mx-auto max-w-5xl">
            {/* Chrome bar */}
            <div className="bg-gray-100 rounded-t-2xl border border-gray-200 border-b-0 px-4 py-3 flex items-center gap-3">
              <div className="flex gap-1.5 flex-shrink-0">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
              </div>
              <div className="flex-1 bg-white rounded-md px-3 py-1 text-xs text-gray-400 text-left border border-gray-200">
                localhost:3000/albums
              </div>
            </div>

            {/* App window */}
            <div className="bg-slate-900 border-x border-b border-white/10 rounded-b-2xl overflow-hidden shadow-2xl">
              <div className="flex h-72">
                {/* Sidebar */}
                <div className="w-48 bg-slate-800/80 border-r border-white/5 p-4 flex-shrink-0">
                  <div className="flex items-center gap-2 mb-6">
                    <div className="w-6 h-6 rounded-md bg-gradient-to-br from-blue-500 to-purple-500" />
                    <div className="h-3 w-20 bg-slate-600 rounded" />
                  </div>
                  {[ { active: false }, { active: true }, { active: false }, { active: false }].map((item, i) => (
                    <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-lg mb-1 ${item.active ? 'bg-blue-600/20' : ''}`}>
                      <div className={`w-3.5 h-3.5 rounded ${item.active ? 'bg-blue-500' : 'bg-slate-600'}`} />
                      <div className={`h-2.5 rounded ${item.active ? 'bg-blue-400/60 w-14' : 'bg-slate-600 w-12'}`} />
                    </div>
                  ))}
                </div>

                {/* Main area */}
                <div className="flex-1 p-5 overflow-hidden">
                  <div className="flex items-center justify-between mb-4">
                    <div className="h-4 w-28 bg-slate-600 rounded" />
                    <div className="flex gap-2">
                      <div className="h-7 w-20 bg-blue-500/20 rounded-lg border border-blue-500/30" />
                      <div className="h-7 w-7 bg-slate-700 rounded-lg" />
                    </div>
                  </div>

                  {/* Photo grid */}
                  <div className="grid grid-cols-5 gap-2">
                    {[...Array(15)].map((_, i) => (
                      <div
                        key={i}
                        className="aspect-square rounded-lg relative overflow-hidden"
                        style={{ background: `linear-gradient(135deg, hsl(${210 + i * 12}, 40%, 18%), hsl(${230 + i * 8}, 50%, 14%))` }}
                      >
                        <div className="absolute inset-0 flex items-center justify-center opacity-20">
                          <svg className="w-6 h-6 text-slate-300" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                          </svg>
                        </div>
                        {i % 4 === 0 && (
                          <div className="absolute inset-1.5 border border-blue-400/50 rounded" />
                        )}
                        {i % 7 === 0 && (
                          <div className="absolute bottom-1 left-1 right-1 bg-blue-500/80 text-white text-[7px] rounded text-center py-0.5 font-medium">
                            98%
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Glow */}
            <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-3/4 h-12 bg-blue-300/30 blur-2xl rounded-full" />
          </div>
        </div>
      </div>

      {/* ── Stats bar ──────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 py-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { value: '100%', label: 'Local Processing' },
              { value: 'Zero', label: 'Cloud Uploads' },
              { value: 'MIT', label: 'Open Source' },
              { value: '<100ms', label: 'Face Search' },
            ].map(({ value, label }) => (
              <div key={label}>
                <div className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">{value}</div>
                <div className="text-sm text-gray-500 mt-1 font-medium">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Features ───────────────────────────────────────── */}
      <div id="features" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="inline-block px-3 py-1 text-xs font-semibold text-blue-600 bg-blue-50 rounded-full uppercase tracking-wider mb-4">
              Features
            </span>
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Everything you need to organize your photos</h2>
            <p className="text-lg text-gray-500 max-w-2xl mx-auto">Powerful AI tools that respect your privacy and run entirely on your machine.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <FeatureCard
              gradient="from-blue-500 to-blue-700"
              icon={<svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>}
              title="AI-Powered Face Detection"
              description="Advanced deep learning models automatically detect and recognize faces in your photos with high accuracy."
            />
            <FeatureCard
              gradient="from-purple-500 to-purple-700"
              icon={<svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>}
              title="100% Private & Local"
              description="All processing happens on your device. Your photos never leave your computer, ensuring complete privacy."
            />
            <FeatureCard
              gradient="from-indigo-500 to-blue-600"
              icon={<svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>}
              title="Smart Search"
              description="Upload any photo and instantly find all similar faces in your collection. Lightning-fast vector search."
            />
            <FeatureCard
              gradient="from-violet-500 to-purple-600"
              icon={<svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>}
              title="Auto-Clustering"
              description="Automatically groups photos by person. Smart merge suggestions help consolidate duplicates."
            />
            <FeatureCard
              gradient="from-sky-500 to-blue-600"
              icon={<svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
              title="Beautiful Gallery"
              description="Browse your photos in a modern, responsive gallery with lightbox viewer and keyboard navigation."
            />
            <FeatureCard
              gradient="from-blue-600 to-indigo-700"
              icon={<svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
              title="Lightning Fast"
              description="Optimized caching and lazy loading ensure smooth performance even with thousands of photos."
            />
          </div>
        </div>
      </div>

      {/* ── How It Works ───────────────────────────────────── */}
      <div id="how-it-works" className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="inline-block px-3 py-1 text-xs font-semibold text-purple-600 bg-purple-50 rounded-full uppercase tracking-wider mb-4">
              How It Works
            </span>
            <h2 className="text-4xl font-bold text-gray-900">Up and running in minutes</h2>
          </div>

          <div className="grid md:grid-cols-4 gap-8 relative">
            {/* Connector line */}
            <div className="hidden md:block absolute top-8 left-[12.5%] right-[12.5%] h-px bg-gradient-to-r from-blue-200 via-purple-200 to-blue-200" />
            <Step number="1" title="Scan Your Folders" description="Point FaceVault to your photo directories and let it scan for images." />
            <Step number="2" title="AI Detection" description="Advanced AI detects and extracts faces from every photo automatically." />
            <Step number="3" title="Smart Grouping" description="Machine learning clusters similar faces together by person." />
            <Step number="4" title="Browse & Search" description="Explore your organized gallery or search for specific people instantly." />
          </div>
        </div>
      </div>

      {/* ── CTA ────────────────────────────────────────────── */}
      <div className="py-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 rounded-3xl p-12 overflow-hidden shadow-2xl text-center">
            <div className="pointer-events-none absolute -top-20 -left-20 w-72 h-72 rounded-full bg-blue-600/30 blur-[80px]" />
            <div className="pointer-events-none absolute -bottom-10 -right-10 w-72 h-72 rounded-full bg-purple-600/30 blur-[80px]" />
            <div className="relative">
              <h2 className="text-4xl font-bold text-white mb-4">Ready to Organize Your Photos?</h2>
              <p className="text-lg text-blue-200 mb-8 max-w-xl mx-auto">
                Start using FaceVault today. No sign-ups, no cloud, no subscriptions — just your photos, organized.
              </p>
              <Link
                href="/dashboard"
                className="inline-block px-8 py-4 bg-white text-slate-900 rounded-xl hover:bg-blue-50 font-semibold text-base shadow-lg transition-all hover:-translate-y-0.5"
              >
                Get Started Now
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer className="bg-gray-950 text-white pt-14 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-10 mb-12">
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <img src="/logo-white.png" alt="FaceVault" className="w-8 h-8 object-contain" />
                <span className="text-lg font-bold">FaceVault</span>
              </div>
              <p className="text-gray-400 text-sm leading-relaxed mb-4">
                AI-powered local photo organization that respects your privacy.
              </p>
              <div className="flex gap-2">
                <a
                  href="https://github.com/ArshvirSk"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="GitHub"
                  className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d={GITHUB_PATH} /></svg>
                </a>
                <a
                  href="https://linkedin.com/in/arshvir-singh-kalsi"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="LinkedIn"
                  className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d={LINKEDIN_PATH} /></svg>
                </a>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Product</h4>
              <ul className="space-y-3 text-sm text-gray-400">
                <li><Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link></li>
                <li><Link href="/albums" className="hover:text-white transition-colors">Albums</Link></li>
                <li><Link href="/search" className="hover:text-white transition-colors">Face Search</Link></li>
                <li><Link href="/people" className="hover:text-white transition-colors">People</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Features</h4>
              <ul className="space-y-3 text-sm text-gray-400">
                <li>Face Detection</li>
                <li>Auto-Clustering</li>
                <li>Smart Search</li>
                <li>Local Processing</li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Creator</h4>
              <p className="text-sm text-gray-400 mb-3">A passion project for privacy-first AI photo organization.</p>
              <p className="text-sm font-semibold text-gray-200 mb-3">Arshvir Singh Kalsi</p>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>
                  <a href="https://github.com/ArshvirSk" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                    GitHub Profile
                  </a>
                </li>
                <li>
                  <a href="https://github.com/ArshvirSk/FaceVault" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                    Source Code
                  </a>
                </li>
                <li>
                  <a href="https://linkedin.com/in/arshvir-singh-kalsi" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                    LinkedIn
                  </a>
                </li>
              </ul>
              <span className="inline-flex items-center mt-4 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-900/50 text-green-400 border border-green-700/50">
                MIT License
              </span>
            </div>
          </div>

          <div className="border-t border-white/5 pt-8 text-center text-sm text-gray-500">
            <p>
              &copy; 2026 FaceVault &mdash; Made by{' '}
              <a
                href="https://github.com/ArshvirSk"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition-colors font-medium"
              >
                Arshvir Singh Kalsi
              </a>
              . Open source &amp; built with privacy in mind.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({ gradient, icon, title, description }: {
  gradient: string
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="group bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200">
      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center mb-5 shadow-md`}>
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-500 text-sm leading-relaxed">{description}</p>
    </div>
  )
}

function Step({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="relative text-center">
      <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 text-white rounded-2xl flex items-center justify-center text-2xl font-bold mx-auto mb-5 shadow-lg shadow-blue-500/20 relative z-10">
        {number}
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-500 text-sm leading-relaxed">{description}</p>
    </div>
  )
}
