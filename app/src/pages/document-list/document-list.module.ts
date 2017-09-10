import { NgModule } from '@angular/core';
import { IonicPageModule } from 'ionic-angular';
import { DocumentListPage } from './document-list';
import { TwitterTimePipe } from "../../pipes/twitter-time/twitter-time";

@NgModule({
  declarations: [
    DocumentListPage,
    TwitterTimePipe,
  ],
  imports: [
    IonicPageModule.forChild(DocumentListPage),
  ],
})
export class DocumentListPageModule {}
