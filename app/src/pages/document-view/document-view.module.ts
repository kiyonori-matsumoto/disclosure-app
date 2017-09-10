import { NgModule } from '@angular/core';
import { IonicPageModule } from 'ionic-angular';
import { DocumentViewPage } from './document-view';

@NgModule({
  declarations: [
    DocumentViewPage,
  ],
  imports: [
    IonicPageModule.forChild(DocumentViewPage),
  ],
})
export class DocumentViewPageModule {}
