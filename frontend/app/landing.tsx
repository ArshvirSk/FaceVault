'use client'

import Link from 'next/link'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Minimal Navbar */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              FaceVault
            </Link>
            <div className="flex items-center gap-6">
              <Link href="/dashboard" className="text-gray-600 hover:text-gray-900 transition-colors">
                Dashboard
              </Link>
              <Link href="/albums" className="text-gray-600 hover:text-gray-900 transition-colors">
                Albums
              </Link>
              <Link href="/search" className="text-gray-600 hover:text-gray-900 transition-colors">
                Search
              </Link>
              <Link
                href="/dashboard"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
        <div className="text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
            Your Photos.
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"> Organized by Faces.</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            FaceVault uses advanced AI to automatically detect, recognize, and organize your photos by the people in them. 
            All processing happens locally on your device - your privacy is guaranteed.
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/dashboard"
              className="px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold text-lg shadow-lg hover:shadow-xl transition-all"
            >
              Get Started
            </Link>
            <Link
              href="/albums"
              className="px-8 py-4 bg-white text-gray-900 rounded-lg hover:bg-gray-50 font-semibold text-lg shadow-lg hover:shadow-xl transition-all border border-gray-200"
            >
              View Albums
            </Link>
          </div>
        </div>

        {/* Feature Preview */}
        <div className="mt-20 bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100">
          <div className="aspect-video bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center relative p-8">
            {/* Mock Gallery Interface */}
            <div className="w-full h-full bg-gray-800 rounded-lg p-6 relative overflow-hidden">
              {/* Mock Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-purple-500"></div>
                  <div>
                    <div className="h-4 w-32 bg-gray-700 rounded mb-2"></div>
                    <div className="h-3 w-24 bg-gray-700 rounded"></div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="w-8 h-8 bg-gray-700 rounded"></div>
                  <div className="w-8 h-8 bg-blue-600 rounded"></div>
                </div>
              </div>

              {/* Mock Photo Grid */}
              <div className="grid grid-cols-6 gap-2">
                {[...Array(18)].map((_, i) => (
                  <div 
                    key={i} 
                    className="aspect-square rounded bg-gradient-to-br from-gray-600 to-gray-700 animate-pulse"
                    style={{ animationDelay: `${i * 0.05}s` }}
                  >
                    {/* Random face-like shapes */}
                    {i % 3 === 0 && (
                      <div className="w-full h-full flex items-center justify-center opacity-30">
                        <svg className="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Floating badge */}
              <div className="absolute top-4 right-4 bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-semibold shadow-lg">
                AI Powered
              </div>

              {/* Bottom gradient overlay */}
              <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-gray-900 to-transparent"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <h2 className="text-4xl font-bold text-center text-gray-900 mb-16">
          Powerful Features for Photo Organization
        </h2>
        
        <div className="grid md:grid-cols-3 gap-8">
          <FeatureCard
            icon={
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            }
            title="AI-Powered Face Detection"
            description="Advanced deep learning models automatically detect and recognize faces in your photos with high accuracy."
          />
          
          <FeatureCard
            icon={
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            }
            title="100% Private & Local"
            description="All processing happens on your device. Your photos never leave your computer, ensuring complete privacy."
          />
          
          <FeatureCard
            icon={
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            }
            title="Smart Search"
            description="Upload any photo and instantly find all similar faces in your collection. Lightning-fast vector search."
          />
          
          <FeatureCard
            icon={
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            }
            title="Auto-Clustering"
            description="Automatically groups photos by person. Smart merge suggestions help consolidate duplicates."
          />
          
          <FeatureCard
            icon={
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            }
            title="Beautiful Gallery"
            description="Browse your photos in a modern, responsive gallery with lightbox viewer and keyboard navigation."
          />
          
          <FeatureCard
            icon={
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            }
            title="Lightning Fast"
            description="Optimized caching and lazy loading ensure smooth performance even with thousands of photos."
          />
        </div>
      </div>

      {/* How It Works */}
      <div className="bg-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-center text-gray-900 mb-16">
            How It Works
          </h2>
          
          <div className="grid md:grid-cols-4 gap-8">
            <Step
              number="1"
              title="Scan Your Folders"
              description="Point FaceVault to your photo directories and let it scan for images."
            />
            <Step
              number="2"
              title="AI Detection"
              description="Advanced AI detects and extracts faces from every photo automatically."
            />
            <Step
              number="3"
              title="Smart Grouping"
              description="Machine learning clusters similar faces together by person."
            />
            <Step
              number="4"
              title="Browse & Search"
              description="Explore your organized gallery or search for specific people instantly."
            />
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl shadow-2xl p-12 text-center">
          <h2 className="text-4xl font-bold text-white mb-4">
            Ready to Organize Your Photos?
          </h2>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            Start using FaceVault today and experience the power of AI-driven photo organization.
          </p>
          <Link
            href="/dashboard"
            className="inline-block px-8 py-4 bg-white text-blue-600 rounded-lg hover:bg-gray-100 font-semibold text-lg shadow-lg hover:shadow-xl transition-all"
          >
            Get Started Now
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-2xl font-bold mb-4">FaceVault</h3>
              <p className="text-gray-400">
                AI-powered local photo organization that respects your privacy.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/dashboard" className="hover:text-white">Dashboard</Link></li>
                <li><Link href="/albums" className="hover:text-white">Albums</Link></li>
                <li><Link href="/search" className="hover:text-white">Search</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Features</h4>
              <ul className="space-y-2 text-gray-400">
                <li>Face Detection</li>
                <li>Auto-Clustering</li>
                <li>Smart Search</li>
                <li>Local Processing</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Technology</h4>
              <ul className="space-y-2 text-gray-400">
                <li>InsightFace AI</li>
                <li>FAISS Vector Search</li>
                <li>Next.js Frontend</li>
                <li>FastAPI Backend</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2026 FaceVault. All rights reserved. Built with privacy in mind.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow border border-gray-100">
      <div className="text-blue-600 mb-4">{icon}</div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  )
}

function Step({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="text-center">
      <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
        {number}
      </div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  )
}
