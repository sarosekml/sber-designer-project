export const hideGhostDragImage = (event: React.DragEvent<HTMLDivElement>, element: HTMLElement) => {
  const ghost = element.cloneNode(true) as HTMLElement;
  ghost.style.display = 'none';
  document.body.appendChild(ghost);
  event.dataTransfer.setDragImage(ghost, 0, 0);
};
