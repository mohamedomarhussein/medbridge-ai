export default function Sidebar({ conversations, activeId, onSelect, onNew, onClose, userName }) {
  return (
    <aside className="w-72 bg-white border-r border-orange-100 flex flex-col h-full">
      <div className="p-4 border-b border-orange-100">
        <button
          onClick={onNew}
          className="w-full py-3 rounded-2xl bg-gradient-to-br from-orange-400 to-rose-400 text-white font-bold text-[14px] hover:shadow-md hover:shadow-orange-200 transition-all flex items-center justify-center gap-2"
        >
          <span className="text-lg">+</span> New conversation
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <p className="text-[11px] font-bold text-[#A89585] uppercase tracking-wider px-2 mb-2">
          Your history
        </p>
        {conversations.length === 0 && (
          <p className="text-[13px] text-[#A89585] px-2 py-3 italic">
            No conversations yet.
          </p>
        )}
        <div className="space-y-1">
          {conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              className={`w-full text-left px-3 py-2.5 rounded-xl transition ${
                activeId === c.id ? 'bg-orange-100 text-[#3D2B1F]' : 'hover:bg-orange-50 text-[#7A6A5C]'
              }`}
            >
              <p className="text-[13px] font-semibold truncate">{c.title}</p>
              <p className="text-[11px] text-[#A89585] mt-0.5">
                {new Date(c.updated_at).toLocaleDateString()} ·{' '}
                {new Date(c.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 border-t border-orange-100">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-300 to-rose-300 flex items-center justify-center text-white font-bold text-[14px]">
            {userName?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-[#3D2B1F] truncate">
              {userName || 'User'}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-full py-2 rounded-xl text-[12px] font-semibold text-[#7A6A5C] hover:bg-orange-50 transition"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
