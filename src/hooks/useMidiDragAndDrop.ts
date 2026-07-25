import { useEffect, useState } from 'react';
import { useSongStore } from '@/state/songStore';
import { isMidiFileName } from '@/midi/loadMidiFile';

/** Handles dragging a .mid/.midi file anywhere onto the window and loading it. */
export function useMidiDragAndDrop(): { isDraggingOver: boolean } {
  const [isDraggingOver, setDraggingOver] = useState(false);
  const loadFromFile = useSongStore((s) => s.loadFromFile);

  useEffect(() => {
    let dragDepth = 0;

    const onDragEnter = (event: DragEvent): void => {
      event.preventDefault();
      dragDepth++;
      setDraggingOver(true);
    };
    const onDragOver = (event: DragEvent): void => {
      event.preventDefault();
    };
    const onDragLeave = (event: DragEvent): void => {
      event.preventDefault();
      dragDepth = Math.max(0, dragDepth - 1);
      if (dragDepth === 0) setDraggingOver(false);
    };
    const onDrop = (event: DragEvent): void => {
      event.preventDefault();
      dragDepth = 0;
      setDraggingOver(false);
      const file = event.dataTransfer?.files[0];
      if (file && isMidiFileName(file.name)) {
        void loadFromFile(file);
      }
    };

    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);

    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, [loadFromFile]);

  return { isDraggingOver };
}
