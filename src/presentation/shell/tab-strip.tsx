/**
 * The one horizontal switch in the shell.
 *
 * It carries the Studio's surfaces and the Preferences sections alike, so a panel body always
 * sits under the same band whichever mode the panel is in.
 */
export function TabStrip<Tab extends string>({
  active, label, onSelect, tabs,
}: {
  tabs: readonly Tab[];
  active: Tab;
  label: string;
  onSelect: (tab: Tab) => void;
}) {
  return (
    <nav aria-label={label} className="tab-strip" role="tablist">
      {tabs.map((tab) => (
        <button
          aria-selected={tab === active}
          className={tab === active ? 'is-active' : ''}
          key={tab}
          onClick={() => onSelect(tab)}
          role="tab"
          type="button"
        >
          {tab}
        </button>
      ))}
    </nav>
  );
}
