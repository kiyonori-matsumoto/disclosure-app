import { NgModule } from '@angular/core';
import { IonicPageModule } from 'ionic-angular';
import { DocumentStreamPage } from './document-stream';
import { TwitterTimePipe } from '../../pipes/twitter-time/twitter-time';
import { TwitterTimeModule } from '../../pipes/twitter-time/twitter-time.module';

@NgModule({
  declarations: [
    DocumentStreamPage,
    // TwitterTimePipe,
  ],
  imports: [
    IonicPageModule.forChild(DocumentStreamPage),
    TwitterTimeModule,
  ],
})
export class DocumentStreamPageModule {}
