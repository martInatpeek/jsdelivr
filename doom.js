export function run() {
  console.log("RUNNING DOOM")

  const styleTag = document.createElement('style');

  styleTag.innerHTML = `
    #doom > .dosbox-container {
      width: 60%;
      margin-left: auto;
      margin-right: auto;
      position: absolute;
      aspect-ratio: 4 / 3;
      transform: translateX(-50%) translateY(-50%);
      top: 50%;
      left: 50%;
    }

    #doom > .dosbox-container > .dosbox-overlay {
      background: url("https://thedoggybrad.github.io/doom_on_js-dos/DOOM.png");
      width: 100%;
      height: 100%;
      background-size: cover;
      background-position: center;
    }

    #doom > .dosbox-container > .dosbox-canvas {
      width: 100%;
      height: 100%;
    }

    #doom > .dosbox-container > .dosbox-overlay > .dosbox-start {
      border-radius: 17px 17px 17px 17px;
      border: 0px solid #000000;
      background-color: rgba(90, 90, 90, 0.57);
      padding: 5px;
      text-align: center;
      vertical-align: middle;
      width: 10em;
      margin: 0 auto;
    }

    #doom > .dosbox-container > .dosbox-overlay > .dosbox-start:before {
      content: 'START';
    }

    a:link {color:white}
  `;

  document.head.appendChild(styleTag);

  const mainContainer = document.querySelector('[data-extension-doom-container]');
  console.log("mainContainer", mainContainer)
  // Add an HTML modal to the main container
  const modal = document.createElement('div');
  modal.id = 'doom-modal';
  modal.style.display = 'none';
  modal.style.position = 'fixed';
  modal.style.zIndex = '1';
  modal.style.left = '0';
  modal.style.top = '0';
  modal.style.width = '100%';
  modal.style.height = '100%';
  modal.style.overflow = 'auto';
  modal.style.backgroundColor = 'rgba(0,0,0,0.8)';

  mainContainer?.appendChild(modal);

  // Add div[data-extension-wrapper="doom"] to modal
  const doomWrapper = document.createElement('div');
  doomWrapper.id = 'doom';
  doomWrapper.classList.add('dosbox-default');
  modal.appendChild(doomWrapper);


  // Toggle modal on button click [data-extension-doom-button]
  const openButton = document.querySelector('[data-extension-doom-button]');

  console.log("openButton", openButton)
  openButton?.addEventListener('click', () => {
    modal.style.display = 'block';
    initDoom();
  });

  // Add close button to the modal
  const closeButton = document.createElement('span');
  closeButton.innerHTML = '&times;';
  closeButton.style.position = 'absolute';
  closeButton.style.top = '0';
  closeButton.style.right = '14px';
  closeButton.style.fontSize = '28px';
  closeButton.style.color = '#fff';
  closeButton.style.cursor = 'pointer';
  modal.appendChild(closeButton);

  closeButton.addEventListener('click', () => {
    modal.style.display = 'none';
  });

  const initDoom = () => {
    const dosbox_DOOM = new Dosbox({
      id: "doom",
      onload: function (_dosbox) {
        console.log(_dosbox);
        dosbox_DOOM.run("https://thedoggybrad.github.io/doom_on_js-dos/DOOM-@evilution.zip", "./DOOM/DOOM.EXE");
      },
      onrun: function (_dosbox, _app) {
        console.log(_dosbox);
        console.log(_app);
        console.log('doom running!');
      }
    });
  };
}