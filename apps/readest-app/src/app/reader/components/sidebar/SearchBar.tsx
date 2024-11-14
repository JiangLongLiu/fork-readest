import React, { useEffect, useRef, useState } from 'react';
import { FaSearch, FaChevronDown } from 'react-icons/fa';

import { useEnv } from '@/context/EnvContext';
import { useReaderStore } from '@/store/readerStore';
import { BookSearchConfig, BookSearchResult } from '@/types/book';
import Dropdown from '@/components/Dropdown';
import SearchOptions from './SearchOptions';

const MINIMUM_SEARCH_TERM_LENGTH = 2;

interface SearchBarProps {
  bookKey: string;
  searchTerm: string;
  onSearchResultChange: (results: BookSearchResult[]) => void;
}

const SearchBar: React.FC<SearchBarProps> = ({
  bookKey,
  searchTerm: term,
  onSearchResultChange,
}) => {
  const { envConfig } = useEnv();
  const { settings, getView, getProgress, getConfig, saveConfig } = useReaderStore();
  const [searchTerm, setSearchTerm] = useState(term);

  const view = getView(bookKey)!;
  const config = getConfig(bookKey)!;
  const progress = getProgress(bookKey)!;
  const searchConfig = config.searchConfig!;

  const queuedSearchTerm = useRef('');
  const isSearchPending = useRef(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    handleSearchTermChange(searchTerm);
  }, [bookKey]);

  useEffect(() => {
    setSearchTerm(term);
    handleSearchTermChange(term);
  }, [term]);

  useEffect(() => {
    return () => {
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }
    };
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);

    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    searchTimeout.current = setTimeout(() => {
      if (!isSearchPending.current) {
        handleSearchTermChange(value);
      } else {
        queuedSearchTerm.current = value;
      }
    }, 500);
  };

  const handleSearchConfigChange = (searchConfig: BookSearchConfig) => {
    config.searchConfig = searchConfig;
    saveConfig(envConfig, bookKey, config, settings);
    handleSearchTermChange(searchTerm);
  };

  const handleSearchTermChange = (term: string) => {
    if (term.length >= MINIMUM_SEARCH_TERM_LENGTH) {
      handleSearch(term);
    } else {
      resetSearch();
    }
  };

  const handleSearch = async (term: string) => {
    console.log('searching for:', term);
    isSearchPending.current = true;
    const { section } = progress;
    const index = searchConfig.scope === 'section' ? section.current : undefined;
    const generator = await view.search({ ...searchConfig, query: term, index });
    const results: BookSearchResult[] = [];
    for await (const result of generator) {
      if (typeof result === 'string') {
        if (result === 'done') {
          onSearchResultChange([...results]);
          isSearchPending.current = false;
          console.log('search done');
          if (queuedSearchTerm.current !== term && queuedSearchTerm.current.length > 2) {
            handleSearch(queuedSearchTerm.current);
          }
        }
      } else {
        if (result.progress) {
          //console.log('search progress:', result.progress);
        } else {
          results.push(result);
          onSearchResultChange([...results]);
        }
      }
    }
  };

  const resetSearch = () => {
    onSearchResultChange([]);
    view?.clearSearch();
  };

  return (
    <div className='relative p-2'>
      <div className='bg-base-100 flex h-8 items-center rounded-lg'>
        <div className='pl-3'>
          <FaSearch className='text-gray-500' />
        </div>

        <input
          type='text'
          value={searchTerm}
          spellCheck={false}
          onChange={handleInputChange}
          placeholder='Search...'
          className='w-full bg-transparent p-2 font-sans text-sm font-light focus:outline-none'
        />

        <div className='flex h-8 w-8 items-center rounded-r-lg bg-gray-300'>
          <Dropdown
            className='dropdown-bottom flex justify-center'
            buttonClassName='btn btn-ghost h-8 min-h-8 w-8 p-0 rounded-none rounded-r-lg'
            toggleButton={<FaChevronDown size={12} className='text-gray-500' />}
          >
            <SearchOptions
              searchConfig={searchConfig}
              onSearchConfigChanged={handleSearchConfigChange}
            />
          </Dropdown>
        </div>
      </div>
    </div>
  );
};

export default SearchBar;
