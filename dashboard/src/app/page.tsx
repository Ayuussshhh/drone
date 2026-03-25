/**
 * Landing Page
 * Home page with navigation to different features
 */

'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Plane,
  Box,
  Play,
  BarChart3,
  Hand,
  Cpu,
  ArrowRight,
  Github,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function HomePage() {
  const { isAuthenticated, user } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-950/80 backdrop-blur-lg border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center">
                <Plane className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-white">Drone Sim IDE</span>
            </div>

            <div className="hidden md:flex items-center gap-6">
              <Link href="/builder" className="text-slate-300 hover:text-white transition-colors">
                Builder
              </Link>
              <Link href="/simulation" className="text-slate-300 hover:text-white transition-colors">
                Simulation
              </Link>
              <Link href="#features" className="text-slate-300 hover:text-white transition-colors">
                Features
              </Link>
            </div>

            <div className="flex items-center gap-4">
              {isAuthenticated ? (
                <>
                  <span className="text-sm text-slate-400 hidden md:block">Welcome, {user?.username}</span>
                  <Link
                    href="/builder"
                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-medium rounded-lg transition-colors"
                  >
                    Open Builder
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/register"
                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-medium rounded-lg transition-colors"
                  >
                    Get Started
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6">
              Build. Simulate.
              <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                {' '}Perfect.
              </span>
            </h1>
            <p className="text-xl text-slate-400 max-w-3xl mx-auto mb-10">
              Professional-grade drone design and simulation IDE with real-time physics,
              3D visualization, and Unity engine integration.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href={isAuthenticated ? '/builder' : '/register'}
                className="px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold rounded-xl transition-all flex items-center gap-2 text-lg"
              >
                Start Building
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                href="/simulation"
                className="px-8 py-4 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl transition-all text-lg"
              >
                View Simulation
              </Link>
            </div>
          </motion.div>

          {/* Hero Preview */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="mt-16 relative"
          >
            <div className="aspect-video max-w-5xl mx-auto bg-slate-900 rounded-2xl border border-slate-700 overflow-hidden shadow-2xl shadow-cyan-500/10">
              <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center relative">
                {/* Grid background */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(6,182,212,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.03)_1px,transparent_1px)] bg-[size:50px_50px]" />

                <div className="text-center z-10">
                  <div className="relative">
                    <Plane className="w-32 h-32 text-cyan-500 mx-auto mb-4 animate-pulse" />
                    <div className="absolute -inset-4 bg-cyan-500/20 blur-3xl rounded-full" />
                  </div>
                  <p className="text-slate-400 text-lg">3D Drone Builder & Real-time Simulation</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-white text-center mb-4">
            Powerful Features
          </h2>
          <p className="text-slate-400 text-center mb-12 max-w-2xl mx-auto">
            Everything you need to design, simulate, and perfect your drone builds
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              icon={Box}
              title="Modular Builder"
              description="Drag-and-drop components with prebuilt motors, propellers, batteries, and frames"
              color="cyan"
            />
            <FeatureCard
              icon={Play}
              title="Real-Time Simulation"
              description="Unity-powered physics simulation with accurate thrust, drag, and stability modeling"
              color="green"
            />
            <FeatureCard
              icon={BarChart3}
              title="Live Metrics"
              description="Real-time charts showing thrust, weight ratio, power consumption, and stability"
              color="yellow"
            />
            <FeatureCard
              icon={Hand}
              title="Gesture Control"
              description="MediaPipe-powered gesture recognition for intuitive drone manipulation"
              color="purple"
            />
            <FeatureCard
              icon={Cpu}
              title="Physics Engine"
              description="Advanced Python-based physics including wind, tether, and stability analysis"
              color="red"
            />
            <FeatureCard
              icon={Plane}
              title="3D Visualization"
              description="Beautiful Three.js rendering with real-time component updates"
              color="blue"
            />
          </div>
        </div>
      </section>

      {/* Tech Stack */}
      <section className="py-20 px-4 bg-slate-900/50">
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Built With Modern Tech</h2>
          <p className="text-slate-400 mb-12">Production-grade architecture for reliability and performance</p>

          <div className="flex flex-wrap justify-center gap-4">
            {['Next.js', 'Three.js', 'Node.js', 'Python', 'Unity', 'PostgreSQL', 'Socket.IO', 'MediaPipe'].map(
              (tech) => (
                <div
                  key={tech}
                  className="px-6 py-3 bg-slate-800 rounded-lg text-slate-300 font-medium border border-slate-700"
                >
                  {tech}
                </div>
              )
            )}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-6">Ready to Build?</h2>
          <p className="text-xl text-slate-400 mb-10">
            Start designing professional drones with our comprehensive toolset
          </p>
          <Link
            href={isAuthenticated ? '/builder' : '/register'}
            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold rounded-xl transition-all text-lg"
          >
            Get Started Free
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-slate-800">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Plane className="w-5 h-5 text-cyan-500" />
            <span className="text-slate-400">Drone Simulation IDE</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="https://github.com" className="text-slate-400 hover:text-white transition-colors">
              <Github className="w-5 h-5" />
            </a>
            <span className="text-slate-500 text-sm">© 2024 All rights reserved</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Feature Card Component
function FeatureCard({
  icon: Icon,
  title,
  description,
  color,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  color: 'cyan' | 'green' | 'yellow' | 'purple' | 'red' | 'blue';
}) {
  const colorClasses = {
    cyan: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    green: 'bg-green-500/10 text-green-400 border-green-500/20',
    yellow: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    red: 'bg-red-500/10 text-red-400 border-red-500/20',
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="p-6 bg-slate-900/50 border border-slate-800 rounded-xl hover:border-slate-700 transition-colors"
    >
      <div className={`w-12 h-12 rounded-lg ${colorClasses[color]} flex items-center justify-center mb-4 border`}>
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-slate-400">{description}</p>
    </motion.div>
  );
}
