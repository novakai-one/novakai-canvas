/** The retained application rail, now exposing only the production Canvas capability. */
import './navigation-rail.css';
import { useState } from 'react';

const CANVAS_ICON = 'M3 4h5v4H3Zm9 8h5v4h-5ZM8 6h3a2 2 0 0 1 2 2v4';

export function NavigationRail() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <nav className="navigation-rail" data-collapsed={collapsed} aria-label="Product areas">
      <div className="navigation-rail__top">
        <span className="navigation-rail__wordmark">{collapsed ? '>_' : '>_ novakai'}</span>
        <button
          type="button"
          className="navigation-rail__collapse"
          onClick={() => setCollapsed((current) => !current)}
          aria-label={collapsed ? 'Expand the rail' : 'Collapse the rail'}
          title={collapsed ? 'Expand the rail' : 'Collapse the rail'}
        >
          {collapsed ? '›' : '‹'}
        </button>
      </div>

      <ul className="navigation-rail__rows">
        <li>
          <button
            type="button"
            className="navigation-rail__row"
            data-current="true"
            aria-current="page"
            title="Canvas"
          >
            <svg className="navigation-rail__icon" viewBox="0 0 20 20" aria-hidden="true">
              <path
                d={CANVAS_ICON}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <span className="navigation-rail__label">Canvas</span>
          </button>
        </li>
      </ul>

      <div className="navigation-rail__footer">
        <span className="navigation-rail__person" title="Chris">CD</span>
        <span className="navigation-rail__label navigation-rail__person-name">Chris</span>
      </div>
    </nav>
  );
}
