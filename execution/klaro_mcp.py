from fastmcp import FastMCP
from openai import OpenAI
import os
import json

# Initialize FastMCP Server
mcp = FastMCP("Klaro AI Backend Server")

# Initialize OpenAI client (requires OPENAI_API_KEY environment variable)
client = OpenAI()

@mcp.tool()
async def research_industry(industry: str, country: str) -> str:
    """
    Research an industry and country for regulatory compliance and best practices.
    Returns professional Markdown formatted research points.
    """
    prompt = f"""Provide a concise overview of regulatory requirements and operational best practices for the {industry} industry in {country}.

Format the response in Markdown with the following sections:
### 📋 Regulatory Compliance
(List 3-4 key laws/regulations to consider)

### 🌟 Industry Best Practices
(List 3-4 operational best practices)

### ⚠️ Common Pitfalls
(List 2-3 common mistakes to avoid)

Keep it brief and highly actionable."""
    
    response = client.chat.completions.create(
        model='gpt-4o',
        messages=[
            {"role": "system", "content": "You are a professional business consultant."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.7,
        max_tokens=800
    )
    return response.choices[0].message.content

@mcp.tool()
async def get_interview_response(history_json: str, system_prompt: str) -> str:
    """
    Get AI response to user input for an SOP interview.
    Expects history_json to be a list of Message objects e.g. [{"role": "user", "content": "..."}]
    """
    messages = [{"role": "system", "content": system_prompt}]
    try:
        messages.extend(json.loads(history_json))
    except Exception as e:
        return f"Error parsing history_json: {str(e)}"
    
    response = client.chat.completions.create(
        model='gpt-4o',
        messages=messages,
        temperature=0.7,
        max_tokens=300
    )
    return response.choices[0].message.content

@mcp.tool()
async def generate_sop(history_json: str, system_prompt: str, sop_prompt: str) -> str:
    """
    Generate the final SOP from interview history.
    """
    messages = [{"role": "system", "content": system_prompt}]
    try:
        messages.extend(json.loads(history_json))
    except Exception as e:
        return f"Error parsing history_json: {str(e)}"
    
    messages.append({"role": "user", "content": sop_prompt})
    
    response = client.chat.completions.create(
        model='gpt-4o',
        messages=messages,
        temperature=0.5,
    )
    return response.choices[0].message.content

@mcp.tool()
async def extract_metadata(history_json: str, title: str, industry: str) -> str:
    """
    Extract metadata (tags, department, estimated time) from the conversation in JSON format.
    """
    metadata_prompt = f"""Based on the conversation about the process "{title}" in the {industry} industry, extract the following metadata in JSON format:
        {{
            "tags": ["tag1", "tag2"],
            "department": "Name of department (e.g., HR, Sales, IT, Ops)",
            "estimatedTime": "Estimated time to complete the process (e.g., 15 mins)"
        }}
        Return ONLY the JSON."""
        
    messages = []
    try:
        messages.extend(json.loads(history_json))
    except Exception:
        pass
    
    messages.append({"role": "user", "content": metadata_prompt})
    
    response = client.chat.completions.create(
        model='gpt-4o',
        messages=messages,
        temperature=0.3,
        response_format={"type": "json_object"}
    )
    return response.choices[0].message.content

if __name__ == "__main__":
    mcp.run()
