import { useState } from 'react'
import { Search } from 'lucide-react'
import { st } from './homeModel'

/** A searchable, keyboard-accessible directory shared by the saved libraries. */
export function CollectionPicker({
  label,
  items,
  value,
  onChange,
  allowEmpty = true,
}: {
  label: string
  items: { id: string; title: string; description?: string }[]
  value: string
  onChange: (id: string) => void
  allowEmpty?: boolean
}) {
  const [query, setQuery] = useState('')
  const match = (item: (typeof items)[number], search: string) =>
    `${item.title}\n${item.description || ''}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())
  const visible = items.filter((item) => match(item, query))
  // Newly saved items remain available even when the current search doesn't match them.
  const selected = items.find((item) => item.id === value)
  const pinned = selected && !visible.some((item) => item.id === value) ? selected : null
  return (
    <div className="collection-picker">
      <div className="collection-picker-heading">
        <strong>{label}</strong>
        <small>
          {visible.length} / {items.length}
        </small>
      </div>
      <label className="collection-search">
        <Search size={15} />
        <input
          type="search"
          value={query}
          aria-label={st('搜索：', 'Search: ') + label}
          placeholder={st('搜索名称或内容…', 'Search name or content…')}
          onChange={(e) => {
            setQuery(e.target.value)
            if (selected && !match(selected, e.target.value))
              onChange(items.find((item) => match(item, e.target.value))?.id || '')
            else if (!value && !allowEmpty)
              onChange(items.find((item) => match(item, e.target.value))?.id || '')
          }}
        />
      </label>
      <select size={5} aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
        {(allowEmpty || !visible.length) && (
          <option value="">{visible.length ? label : st('没有匹配的条目', 'No matching items')}</option>
        )}
        {pinned && (
          <option value={pinned.id}>
            {pinned.title} · {st('当前选择', 'Current selection')}
          </option>
        )}
        {visible.map((item) => (
          <option key={item.id} value={item.id}>
            {item.title || st('未命名', 'Untitled')}
          </option>
        ))}
      </select>
    </div>
  )
}
