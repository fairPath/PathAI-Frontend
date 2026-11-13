'use client';

import { SearchIcon } from 'lucide-react';
import SplitText from '../shared/SplitText';
import { useState } from 'react';
import { AutoComplete } from '../ui/autocomplete';
import { Button } from '../ui/button';
import { useRouter } from 'next/navigation';

function DashboardSearch() {
  const [searchValue, setSearchValue] = useState<string>('');
  const [selectedValue, setSelectedValue] = useState<string>('');
  const router = useRouter();

  const items = [
    { value: 'Software Engineer', label: 'Software Engineer' },
    { value: 'Data Scientist', label: 'Data Scientist' },
    { value: 'Product Manager', label: 'Product Manager' },
    { value: 'UX Designer', label: 'UX Designer' },
    { value: 'Marketing Specialist', label: 'Marketing Specialist' },
    { value: 'Sales Executive', label: 'Sales Executive' },
    { value: 'HR Manager', label: 'HR Manager' },
    { value: 'Project Coordinator', label: 'Project Coordinator' },
    { value: 'Business Analyst', label: 'Business Analyst' },
    { value: 'Web Developer', label: 'Web Developer' },
    { value: 'Graphic Designer', label: 'Graphic Designer' },
    { value: 'Data Analyst', label: 'Data Analyst' },
    { value: 'Content Writer', label: 'Content Writer' },
    { value: 'Customer Support', label: 'Customer Support' },
    { value: 'Network Administrator', label: 'Network Administrator' },
    { value: 'DevOps Engineer', label: 'DevOps Engineer' },
    { value: 'Cybersecurity Analyst', label: 'Cybersecurity Analyst' },
  ];

  const filteredRoles = items.filter((role) =>
    role.label.toLowerCase().includes(searchValue.toLowerCase())
  );

  const handleButtonClick = () => {
    const params = new URLSearchParams({
      titleOnly: searchValue.trim(),
      _search: crypto.randomUUID(),
    });
    router.push(`/dashboard/search-results?${params}`);
  };

  return (
    <div className="flex flex-col justify-center w-full items-center min-h-160">
      <h1 className="text-3xl font-bold mb-4 tracking-wide">
        <SplitText text="Find Your Dream Job"></SplitText>
      </h1>
      <div className="relative w-full max-w-2xl">
        <AutoComplete
          placeholder="Search for jobs roles..."
          selectedValue={selectedValue}
          onSelectedValueChange={setSelectedValue}
          searchValue={searchValue}
          onSearchValueChange={setSearchValue}
          emptyMessage="No items."
          isLoading={false}
          items={filteredRoles}
        />

        <Button
          variant="ghost"
          className="p-0 m-0 bg-transparent border-none shadow-none hover:bg-transparent focus-visible:ring-0"
          disabled={searchValue === ''}
          onClick={() => {
            handleButtonClick();
          }}
        >
          <div className="absolute right-3 top-1/3 -translate-y-1/2 h-7 w-4 text-muted-foreground ">
            <SearchIcon />
          </div>
        </Button>
      </div>
    </div>
  );
}

export default DashboardSearch;
