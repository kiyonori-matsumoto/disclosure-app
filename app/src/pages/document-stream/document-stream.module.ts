import { NgModule } from '@angular/core';
import { IonicPageModule } from 'ionic-angular';
import { DocumentStreamPage } from './document-stream';
import { TwitterTimePipe } from '../../pipes/twitter-time/twitter-time';
import { TwitterTimeModule } from '../../pipes/twitter-time/twitter-time.module';
import { PipesModule } from '../../pipes/pipes.module';
import { BrowserModule } from '@angular/platform-browser';

@NgModule({
  declarations: [
    DocumentStreamPage,
    // TwitterTimePipe,
  ],
  imports: [
    IonicPageModule.forChild(DocumentStreamPage),
    TwitterTimeModule,
    PipesModule,
    BrowserModule,
  ],
})
export class DocumentStreamPageModule {}
