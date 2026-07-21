import React from 'react';

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  unit: string;
  colorClass: string;
}

export default function StatCard({
  icon: Icon,
  label,
  value,
  unit,
  colorClass,
}: StatCardProps) {
  return (
    <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center space-x-4">
      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${colorClass}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <h3 className="text-2xl font-bold text-gray-800">
          {value} <span className="text-sm font-normal text-gray-500">{unit}</span>
        </h3>
      </div>
    </div>
  );
}
