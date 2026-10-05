"use client";
import { SearchOutlined, CloseCircleFilled } from '@ant-design/icons';

export default function SearchBar({ value, onChange, placeholder = 'Keresés az események között...', resultCount }) {
  const hasQuery = value.trim().length > 0;

  return (
    <div className="mb-6 flex flex-col items-center gap-2">
      <div className="relative w-full max-w-xl">
        <SearchOutlined className="absolute left-4 top-1/2 -translate-y-1/2 text-[#E5B15D] text-lg pointer-events-none" />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') onChange(''); }}
          placeholder={placeholder}
          aria-label="Keresés az események között"
          className="w-full rounded-full border-2 border-[#4A2E33] bg-[#1a1012] py-3 pl-12 pr-12 text-[#E0D6C8] placeholder:text-[#7d6d70] transition-colors duration-300 focus:border-[#E5B15D] focus:outline-none"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label="Keresés törlése"
            className="absolute right-4 top-1/2 -translate-y-1/2 text-[#baaaac] hover:text-[#E5B15D] cursor-pointer bg-transparent border-none transition-colors"
          >
            <CloseCircleFilled />
          </button>
        )}
      </div>
      {hasQuery && typeof resultCount === 'number' && (
        <p className="text-[#baaaac] text-sm m-0">{resultCount} találat</p>
      )}
    </div>
  );
}
