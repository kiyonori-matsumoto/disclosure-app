import { NgModule } from '@angular/core';
import { IonicPageModule } from 'ionic-angular';
import { DocumentViewPage } from './document-view';
import { PdfViewerComponent } from 'ng2-pdf-viewer';
import { ComponentsModule } from '../../components/components.module';

@NgModule({
  declarations: [
    DocumentViewPage,
    PdfViewerComponent,
  ],
  imports: [
    IonicPageModule.forChild(DocumentViewPage),
    ComponentsModule,
  ], 
})
export class DocumentViewPageModule {}
