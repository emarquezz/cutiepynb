import re

def maquillate(title, level, colors,span=True):
    """
    Add color to a title string based on the level and colors arguments.
    
    Args:
        title (str): The title to be formatted.
        level (int): The level of the heading.
        colors (List[str]): A list of colors to be used for the headings.
        
    Returns:
        str: The formatted title string.
    """
    color = colors[level % len(colors)]
    if span:
        return f'<span style="color: {color}">{title}</span>'
    else:
        return f' style="color: {color}">{title}'


def update_heading_colors_in_document(document, new_colors):
    """
    Update the colors of the headings in a Jupyter notebook by modifying the inline styles
    of existing <span> tags without creating nested tags.

    Args:
        document (Dict[str, Union[str, Dict[str, Any], List[Dict[str, Any]]]]): A dictionary representing a Jupyter notebook.
        new_colors (List[str]): A list of new colors to be used for the headings.

    Returns:
        Dict[str, Union[str, Dict[str, Any], List[Dict[str, Any]]]]: The updated Jupyter notebook with new colors applied to the headings.
    """
    def update_existing_color_span(text, level, new_color):
        """
        Helper function to update the color in an existing <span> tag.

        Args:
            text (str): The HTML text containing the <span> tag.
            level (int): The heading level.
            new_color (str): The new color to apply.

        Returns:
            str: The HTML text with the updated color.
        """
        # Regular expression to find and update the color inside a <span> style attribute
        color_regex = r'style="color:\s*#[0-9a-fA-F]{6}"'
        updated_style = f'style="color: {new_color}"'
        updated_text = re.sub(color_regex, updated_style, text)
        return updated_text

    # Loop through all cells in the document and update colors for headings
    for cell in document['cells']:
        if cell['cell_type'] == 'markdown':
            source = cell['source']
            if isinstance(source, list):
                source = ''.join(source)

            updated_source_lines = []
            for line in source.splitlines():
                if line.startswith('#'):
                    level = len(re.match(r'#+', line).group(0))
                    title_html_match = re.search(r'<span[^>]*>(.*?)</span>', line)
                    if title_html_match:
                        title_html = title_html_match.group(0)  # Full <span> HTML including attributes
                        new_color = new_colors[level % len(new_colors)]
                        updated_title_html = update_existing_color_span(title_html, level, new_color)
                        updated_line = f"{'#' * level} {updated_title_html}"
                        updated_source_lines.append(updated_line)
                    else:
                        updated_source_lines.append(line)  # If no match, just append the line as is
                else:
                    updated_source_lines.append(line)

            # Update the cell's source with the modified lines
            cell['source'] = '\n'.join(updated_source_lines)

    return document