import { NgModule } from '@angular/core';
import { IonicPageModule } from 'ionic-angular';
import { CustomTagsPage } from './custom-tags';

@NgModule({
  declarations: [
    CustomTagsPage,
  ],
  imports: [
    IonicPageModule.forChild(CustomTagsPage),
  ],
})
export class CustomTagsPageModule {}
