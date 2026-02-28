package com.antispoiler.app

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView

class KeywordsAdapter(
    private var keywords: List<String>,
    private val onRemove: (String) -> Unit
) : RecyclerView.Adapter<KeywordsAdapter.KeywordViewHolder>() {

    fun updateKeywords(newKeywords: List<String>) {
        keywords = newKeywords
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): KeywordViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_keyword, parent, false)
        return KeywordViewHolder(view)
    }

    override fun onBindViewHolder(holder: KeywordViewHolder, position: Int) {
        holder.bind(keywords[position])
    }

    override fun getItemCount() = keywords.size

    inner class KeywordViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        private val textView: TextView = itemView.findViewById(R.id.keywordText)
        private val removeButton: Button = itemView.findViewById(R.id.removeButton)

        fun bind(keyword: String) {
            textView.text = keyword
            removeButton.setOnClickListener {
                onRemove(keyword)
            }
        }
    }
}
