import React from 'react'

interface ActionToolbarProps {
  selectedKeysCount: number
  onClearSelection: () => void
  onBulkDelete: () => void
  bulkDeleteMutation: {
    isPending: boolean
  }
}

const ActionToolbar: React.FC<ActionToolbarProps> = ({
  selectedKeysCount,
  onClearSelection,
  onBulkDelete,
  bulkDeleteMutation,
}) => {
  if (selectedKeysCount === 0) return null

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <p className="text-sm font-medium text-blue-900">
            {selectedKeysCount} item{selectedKeysCount > 1 ? 's' : ''} selected
          </p>
          <button
            onClick={onClearSelection}
            className="text-xs text-blue-600 hover:text-blue-800 underline"
          >
            Clear selection
          </button>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={onBulkDelete}
            disabled={bulkDeleteMutation.isPending}
            className="inline-flex items-center px-3 py-2 border border-red-300 text-sm font-medium rounded-md shadow-sm text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {bulkDeleteMutation.isPending ? (
              <>
                <div className="animate-spin -ml-1 mr-2 h-4 w-4 border-2 border-red-400 border-t-transparent rounded-full"></div>
                Deleting...
              </>
            ) : (
              <>
                <svg
                  className="-ml-1 mr-2 h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
                Delete ({selectedKeysCount})
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ActionToolbar
