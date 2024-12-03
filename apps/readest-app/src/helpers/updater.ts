import { check } from '@tauri-apps/plugin-updater';
import { ask } from '@tauri-apps/plugin-dialog';
import { relaunch } from '@tauri-apps/plugin-process';

export const checkForAppUpdates = async () => {
  const update = await check();
  if (update) {
    const yes = await ask(
      `
      Update to ${update.version} is available!
      Release notes: ${update.body}
      `,
      {
        title: 'Update Now!',
        kind: 'info',
        okLabel: 'Update',
        cancelLabel: 'Cancel',
      },
    );

    if (yes) {
      console.log(`found update ${update.version} from ${update.date} with notes ${update.body}`);
      let downloaded = 0;
      let contentLength = 0;
      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            contentLength = event.data.contentLength!;
            console.log(`started downloading ${event.data.contentLength} bytes`);
            break;
          case 'Progress':
            downloaded += event.data.chunkLength;
            console.log(`downloaded ${downloaded} from ${contentLength}`);
            break;
          case 'Finished':
            console.log('download finished');
            break;
        }
      });
      console.log('update installed');
      await relaunch();
    }
  }
};
