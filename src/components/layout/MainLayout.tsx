'use client';

import Sidebar from './Sidebar';
import Header from './Header';
import Footer from './Footer';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 overflow-hidden font-sans transition-colors duration-200">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 overflow-y-auto p-4 lg:p-8 flex flex-col justify-between bg-gray-50 dark:bg-gray-950 transition-colors duration-200">
          <div>
            {children}
          </div>
          <Footer />
        </main>
      </div>
    </div>
  );
}
