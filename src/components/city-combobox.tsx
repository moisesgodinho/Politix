"use client";

import { useDeferredValue, useId, useState } from "react";

import type { MunicipalityOption } from "@/lib/types";

type CityComboboxProps = {
  cities: MunicipalityOption[];
  onSelect: (city: MunicipalityOption) => void;
  selectedCity: MunicipalityOption | null;
};

export function CityCombobox({
  cities,
  onSelect,
  selectedCity
}: CityComboboxProps) {
  const inputId = useId();
  const listboxId = `${inputId}-listbox`;
  const [query, setQuery] = useState(selectedCity?.name ?? "");
  const [isOpen, setIsOpen] = useState(false);
  const deferredQuery = useDeferredValue(query);

  const normalizedQuery = deferredQuery.trim().toLocaleLowerCase("pt-BR");
  const filteredCities = cities
    .filter((city) => {
      if (!normalizedQuery) {
        return true;
      }

      const normalizedName = city.name.toLocaleLowerCase("pt-BR");
      const normalizedRegion = city.intermediateRegion.toLocaleLowerCase("pt-BR");

      return (
        normalizedName.includes(normalizedQuery) ||
        city.code.includes(normalizedQuery) ||
        normalizedRegion.includes(normalizedQuery)
      );
    })
    .slice(0, 10);

  return (
    <div className="relative">
      <label className="mb-2 block text-sm font-semibold text-slate-700" htmlFor={inputId}>
        Municipio mineiro
      </label>
      <input
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-expanded={isOpen}
        className="field"
        id={inputId}
        onBlur={() => {
          window.setTimeout(() => {
            setIsOpen(false);
            if (selectedCity) {
              setQuery(selectedCity.name);
            }
          }, 120);
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder="Busque por Belo Horizonte, Uberlandia, Vicosa..."
        role="combobox"
        value={query}
      />

      {isOpen ? (
        <div className="absolute left-0 right-0 top-[calc(100%+0.6rem)] z-20 overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-soft">
          <ul className="max-h-80 overflow-y-auto p-2" id={listboxId} role="listbox">
            {filteredCities.length > 0 ? (
              filteredCities.map((city) => (
                <li key={city.code}>
                  <button
                    className="flex w-full items-start justify-between rounded-2xl px-4 py-3 text-left transition hover:bg-slate-50"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      onSelect(city);
                      setQuery(city.name);
                      setIsOpen(false);
                    }}
                    type="button"
                  >
                    <span>
                      <span className="block text-sm font-semibold text-slate-900">
                        {city.name}
                      </span>
                      <span className="block text-xs text-slate-500">
                        {city.immediateRegion} - IBGE {city.code}
                      </span>
                    </span>
                    <span className="mt-0.5 text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                      MG
                    </span>
                  </button>
                </li>
              ))
            ) : (
              <li className="px-4 py-6 text-sm text-slate-500">
                Nenhuma cidade de MG encontrada para esse termo.
              </li>
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
