import { useState, useCallback, useMemo } from "react";
import { Search, X } from "lucide-react";

/**
 * Searchable student selection component for next round
 * Allows faculty/admin to search and select multiple students
 */
const SearchableStudentSelect = ({ students, selectedIds, onSelectionChange }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [expanded, setExpanded] = useState(false);

  // Debounced search filter
  const filteredStudents = useMemo(() => {
    if (!searchTerm.trim()) {
      return students;
    }

    const query = searchTerm.toLowerCase();
    return students.filter((student) => {
      const name = (student.studentId?.name || "").toLowerCase();
      const email = (student.studentId?.email || "").toLowerCase();
      const studentId = (student.studentId?.studentId || "").toLowerCase();
      const prn = (student.studentId?.studentId || "").toLowerCase(); // PRN is studentId

      return name.includes(query) || email.includes(query) || studentId.includes(query) || prn.includes(query);
    });
  }, [students, searchTerm]);

  const handleToggle = useCallback(
    (studentId) => {
      if (selectedIds.includes(studentId)) {
        onSelectionChange(selectedIds.filter((id) => id !== studentId));
      } else {
        onSelectionChange([...selectedIds, studentId]);
      }
    },
    [selectedIds, onSelectionChange]
  );

  const handleSelectAll = useCallback(() => {
    const allIds = filteredStudents.map((s) => s.studentId.studentId);
    onSelectionChange(allIds);
  }, [filteredStudents, onSelectionChange]);

  const handleDeselectAll = useCallback(() => {
    onSelectionChange([]);
  }, [onSelectionChange]);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-900 mb-3">
          Select Students for Next Round ({selectedIds.length} selected)
        </h3>

        {/* Search Bar */}
        <div className="relative mb-3">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, email, or PRN..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2 mb-3">
          <button
            onClick={handleSelectAll}
            disabled={filteredStudents.length === 0}
            className="text-xs px-3 py-1.5 bg-indigo-100 text-indigo-700 hover:bg-indigo-200 rounded border border-indigo-300 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Select All Shown
          </button>
          <button
            onClick={handleDeselectAll}
            disabled={selectedIds.length === 0}
            className="text-xs px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded border border-slate-300 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Clear Selection
          </button>
        </div>

        {/* Expandable List */}
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {filteredStudents.length === 0 ? (
            <p className="text-xs text-slate-500 py-8 text-center">
              {students.length === 0 ? "No students available" : "No students match your search"}
            </p>
          ) : (
            filteredStudents.map((record) => {
              const student = record.studentId;
              const isSelected = selectedIds.includes(student.studentId);

              return (
                <div
                  key={student.studentId}
                  onClick={() => handleToggle(student.studentId)}
                  className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition border ${
                    isSelected
                      ? "bg-indigo-50 border-indigo-300"
                      : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleToggle(student.studentId)}
                    className="w-4 h-4 rounded accent-indigo-600 cursor-pointer"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{student.name}</p>
                    <p className="text-xs text-slate-600">
                      {student.studentId} • {student.email}
                    </p>
                  </div>
                  {isSelected && <div className="text-indigo-600 text-sm">✓</div>}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchableStudentSelect;
