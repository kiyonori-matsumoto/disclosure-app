import { NgModule } from '@angular/core';
import { IonicPageModule } from 'ionic-angular';
import { DocumentViewPage } from './document-view';
import { PdfViewerComponent } from 'ng2-pdf-viewer';

@NgModule({
  declarations: [
    DocumentViewPage,
    PdfViewerComponent,
  ],
  imports: [
    IonicPageModule.forChild(DocumentViewPage),
  ], 
})
export class DocumentViewPageModule {}
