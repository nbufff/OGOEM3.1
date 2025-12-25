import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export const exportToPdf = async (elementId: string, fileName: string) => {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Element with id ${elementId} not found`);
    return;
  }

  // Visual feedback
  const originalCursor = document.body.style.cursor;
  document.body.style.cursor = 'wait';

  try {
    // Capture the element
    const canvas = await html2canvas(element, {
      scale: 1.5, // 1.5x resolution for better quality but manageable size
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      ignoreElements: (node) => {
          // Ignore any elements with 'no-print' class
          return node.classList?.contains('no-print');
      },
      onclone: (clonedDoc) => {
        const clonedElement = clonedDoc.getElementById(elementId);
        if (clonedElement) {
            // 1. Fix Truncated Text (Work Package Titles, Task Names)
            // Remove 'truncate' class and force wrapping
            const truncated = clonedElement.querySelectorAll('.truncate');
            truncated.forEach((el) => {
                el.classList.remove('truncate');
                if (el instanceof HTMLElement) {
                    el.style.whiteSpace = 'normal';
                    el.style.overflow = 'visible';
                    el.style.textOverflow = 'clip';
                    el.style.wordBreak = 'break-word';
                    el.style.height = 'auto'; 
                }
            });

            // 2. Expand Scrollable Areas to show all tasks
            const scrollContainers = clonedElement.querySelectorAll('.overflow-y-auto, .task-scroll-container');
            scrollContainers.forEach((el) => {
                if (el instanceof HTMLElement) {
                    el.style.overflow = 'visible';
                    el.style.height = 'auto';
                    el.style.maxHeight = 'none';
                }
            });
            
            // 3. Layout Adjustments based on View Mode
            if (elementId === 'board-content-area') {
                // Board view uses Flexbox. We need to allow height to grow to fit expanded task lists.
                clonedElement.style.height = 'auto';
                clonedElement.style.width = 'fit-content'; 
                clonedElement.style.alignItems = 'flex-start'; 

                // Wrapper divs for WorkPackageCards
                Array.from(clonedElement.children).forEach(child => {
                    if (child instanceof HTMLElement) {
                        child.style.height = 'auto';
                        // The WorkPackageCard itself
                        if (child.firstElementChild instanceof HTMLElement) {
                             const card = child.firstElementChild;
                             card.style.height = 'auto';
                             card.style.overflow = 'visible';
                        }
                    }
                });
            } else if (elementId === 'gantt-content-area') {
                // Gantt view uses Absolute positioning for rows. 
                // The container ALREADY has explicit width/height calculated in React.
                // Setting height to 'auto' would collapse it to just the header height.
                // So we preserve the dimensions but ensure overflow is visible.
                clonedElement.style.overflow = 'visible';
            }
        }
      }
    });

    const imgData = canvas.toDataURL('image/png');
    
    // Create PDF with dimensions matching the canvas
    const pdf = new jsPDF({
      orientation: canvas.width > canvas.height ? 'l' : 'p',
      unit: 'px',
      format: [canvas.width, canvas.height] 
    });

    pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
    pdf.save(`${fileName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_schedule.pdf`);

  } catch (error) {
    console.error("PDF Export failed", error);
    alert("Could not generate PDF. Please ensure the chart is fully loaded.");
  } finally {
    document.body.style.cursor = originalCursor;
  }
};