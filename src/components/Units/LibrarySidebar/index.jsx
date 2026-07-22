import React from 'react';
import {
  Add as AddIcon,
  FolderOutlined as FolderOutlinedIcon,
  WidgetsOutlined as WidgetsOutlinedIcon,
} from '@mui/icons-material';
import { Box, Typography } from '@mui/material';

const SIDEBAR_WIDTH = 240;

/**
 * Figma "Library" sidebar (#100:12870)
 * Shows folder navigation for the Library page.
 */
const LibrarySidebar = ({
  folders = [],
  activeFolderId = null,
  totalItems = 0,
  onSelectAll = null,
  onSelectFolder = null,
  onAddFolder = null,
}) => {
  const folderItems = folders.length > 0
    ? folders
    : [
        { id: 't1d', name: 'Type 1 Diabetes', count: 12 },
        { id: 'panc', name: 'Pancreatic Cancer', count: 8 },
        { id: 'gene', name: 'Gene Function Reviews', count: 15 },
        { id: 'lrq3', name: 'Literature Review Q3', count: 5 },
      ];

  return (
    <Box
      className="library-sidebar"
      sx={{
        width: SIDEBAR_WIDTH,
        minWidth: SIDEBAR_WIDTH,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        p: 'var(--space-6) var(--space-4)',
        gap: 'var(--space-4)',
        bgcolor: 'var(--color-neutral-white)',
        borderRight: '1px solid var(--color-grey-100)',
        boxSizing: 'border-box',
        overflowY: 'auto',
      }}
    >
      {/* All Items */}
      <Box
        role="button"
        onClick={() => onSelectAll?.()}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          px: 'var(--space-3)',
          height: 32,
          borderRadius: 'var(--radius-2)',
          bgcolor: activeFolderId === null ? 'var(--color-blue-50)' : 'transparent',
          cursor: 'pointer',
          '&:hover': { bgcolor: 'var(--color-blue-25)' },
        }}
      >
        <WidgetsOutlinedIcon sx={{ fontSize: 16, color: activeFolderId === null ? 'var(--color-blue-500)' : 'var(--color-grey-400)' }} />
        <Typography sx={{
          fontFamily: 'var(--font-family-sans)', fontSize: 14, fontWeight: 500,
          color: activeFolderId === null ? 'var(--color-blue-500)' : 'var(--color-grey-800)',
          flex: 1,
        }}>
          All Items
        </Typography>
        <Typography sx={{
          fontFamily: 'var(--font-family-sans)', fontSize: 14, fontWeight: 500,
          color: activeFolderId === null ? 'var(--color-blue-500)' : 'var(--color-grey-400)',
        }}>
          {totalItems || 27}
        </Typography>
      </Box>

      {/* Folders section */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 'var(--space-2)', pr: 0 }}>
          <Typography sx={{
            fontFamily: 'var(--font-family-sans)', fontSize: 12, fontWeight: 500,
            color: 'var(--color-grey-500)',
          }}>
            Folders
          </Typography>
          <Box
            role="button"
            onClick={() => onAddFolder?.()}
            sx={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 20, height: 20, borderRadius: 'var(--radius-1)',
              color: 'var(--color-grey-400)', cursor: 'pointer',
              '&:hover': { bgcolor: 'var(--color-grey-50)', color: 'var(--color-grey-600)' },
            }}
          >
            <AddIcon sx={{ fontSize: 16 }} />
          </Box>
        </Box>

        {folderItems.map((folder) => (
          <Box
            key={folder.id}
            role="button"
            onClick={() => onSelectFolder?.(folder.id)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              px: 'var(--space-3)',
              height: 32,
              borderRadius: 'var(--radius-2)',
              bgcolor: activeFolderId === folder.id ? 'var(--color-blue-50)' : 'transparent',
              cursor: 'pointer',
              '&:hover': { bgcolor: 'var(--color-blue-25)' },
            }}
          >
            <FolderOutlinedIcon sx={{ fontSize: 16, color: activeFolderId === folder.id ? 'var(--color-blue-500)' : 'var(--color-grey-400)' }} />
            <Typography sx={{
              fontFamily: 'var(--font-family-sans)', fontSize: 14, fontWeight: 400,
              color: activeFolderId === folder.id ? 'var(--color-blue-500)' : 'var(--color-grey-800)',
              flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {folder.name}
            </Typography>
            {folder.count != null && (
              <Typography sx={{
                fontFamily: 'var(--font-family-sans)', fontSize: 14, fontWeight: 400,
                color: 'var(--color-grey-400)',
              }}>
                {folder.count}
              </Typography>
            )}
          </Box>
        ))}

        {/* Add new folder */}
        <Box
          role="button"
          onClick={() => onAddFolder?.()}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            px: 'var(--space-3)',
            height: 32,
            borderRadius: 'var(--radius-2)',
            cursor: 'pointer',
            '&:hover': { bgcolor: 'var(--color-grey-25)' },
          }}
        >
          <AddIcon sx={{ fontSize: 16, color: 'var(--color-grey-400)' }} />
          <Typography sx={{
            fontFamily: 'var(--font-family-sans)', fontSize: 14, fontWeight: 400,
            color: 'var(--color-grey-500)',
          }}>
            Add new folder
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default LibrarySidebar;
export { SIDEBAR_WIDTH };
